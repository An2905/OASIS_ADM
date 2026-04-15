import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import express from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pg from "pg";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import Busboy from "busboy";

import { requireAdmin, verifyLogin } from "./auth.js";
import { getPublicSettings, upsertPublicSettings, PublicSettingsSchema } from "./settings.js";
import {
  createRoom,
  deleteRoom,
  getRoomById,
  listRooms,
  normalizeRoomInput,
  RoomCategoryInputSchema,
  updateRoom
} from "./rooms.js";
import { createMedia, getMediaById } from "./media.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const app = express();

// Railway/Reverse-proxy friendly (needed for secure cookies)
app.set("trust proxy", 1);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(morgan("combined"));
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cookieParser());
app.use(express.urlencoded({ extended: false }));
app.use(express.json({ limit: "1mb" }));

const PgSession = connectPgSimple(session);
const databaseUrl = process.env.DATABASE_URL || "";
const shouldUsePgSession = Boolean(databaseUrl);
const isRailwayInternal = databaseUrl.includes("railway.internal");
const sslModeRequires =
  /(?:^|[?&])sslmode=require(?:&|$)/i.test(databaseUrl) ||
  /(?:^|[?&])ssl=true(?:&|$)/i.test(databaseUrl) ||
  String(process.env.PGSSLMODE || "").toLowerCase() === "require";

const pgPool = shouldUsePgSession
  ? new pg.Pool({
      connectionString: databaseUrl,
      // Railway internal Postgres typically doesn't use TLS.
      // Only enable SSL when the connection string (or env) explicitly requires it.
      ssl: !isRailwayInternal && sslModeRequires ? { rejectUnauthorized: false } : undefined
    })
  : null;

app.use(
  session({
    name: "oasis_admin",
    secret: process.env.SESSION_SECRET || "dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
    rolling: true,
    store: pgPool
      ? new PgSession({
          pool: pgPool,
          tableName: "Session",
          createTableIfMissing: true
        })
      : undefined,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000
    }
  })
);

function shouldBypassHtml(reqPath) {
  return (
    reqPath.startsWith("/assets/") ||
    reqPath === "/assets" ||
    reqPath.startsWith("/wp-content/") ||
    reqPath === "/wp-content" ||
    reqPath.startsWith("/wp-includes/") ||
    reqPath === "/wp-includes" ||
    reqPath.startsWith("/admin") ||
    reqPath.startsWith("/api/") ||
    reqPath === "/api" ||
    reqPath === "/healthz"
  );
}

function safeJoinRoot(root, reqPath) {
  const normalized = path.posix.normalize(reqPath);
  const stripped = normalized.replace(/^(\.\.(\/|\\|$))+/, "");
  const full = path.join(root, stripped);
  const resolved = path.resolve(full);
  if (!resolved.startsWith(root)) return null;
  return resolved;
}

async function tryServeHtmlWithInjection(req, res, next) {
  if (req.method !== "GET") return next();
  if (shouldBypassHtml(req.path)) return next();

  const accept = String(req.headers.accept || "");
  if (!accept.includes("text/html") && accept !== "*/*") return next();

  const candidatePaths = [];
  if (req.path === "/") {
    candidatePaths.push(path.join(rootDir, "index.html"));
  } else if (req.path.endsWith("/")) {
    const p = safeJoinRoot(rootDir, path.posix.join(req.path, "index.html"));
    if (p) candidatePaths.push(p);
  } else if (path.extname(req.path)) {
    const p = safeJoinRoot(rootDir, req.path);
    if (p) candidatePaths.push(p);
  } else {
    const p = safeJoinRoot(rootDir, path.posix.join(req.path, "index.html"));
    if (p) candidatePaths.push(p);
  }

  for (const filePath of candidatePaths) {
    try {
      const stat = await fs.stat(filePath);
      if (!stat.isFile()) continue;
      if (path.extname(filePath).toLowerCase() !== ".html") continue;

      let html = await fs.readFile(filePath, "utf8");
      if (!html.includes("/assets/site-en.js")) {
        html = html.replace(
          /<\/body\s*>/i,
          '  <script defer src="/assets/site-en.js?v=2"></script>\n  <script defer src="/assets/room-detail-from-db.js?v=2"></script>\n  <script defer src="/assets/home-accommodations-from-db.js?v=3"></script>\n</body>'
        );
      } else if (!html.includes("/assets/room-detail-from-db.js")) {
        html = html.replace(
          /<\/body\s*>/i,
          '  <script defer src="/assets/room-detail-from-db.js?v=2"></script>\n</body>'
        );
      } else if (!html.includes("/assets/home-accommodations-from-db.js")) {
        html = html.replace(
          /<\/body\s*>/i,
          '  <script defer src="/assets/home-accommodations-from-db.js?v=3"></script>\n</body>'
        );
      }

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.status(200).send(html);
    } catch {
      // Not found: keep trying
    }
  }

  return next();
}

app.use(tryServeHtmlWithInjection);

// --- Static serving (allowlist) ---
app.use("/assets", express.static(path.join(rootDir, "assets")));
app.use("/wp-content", express.static(path.join(rootDir, "wp-content")));
app.use("/wp-includes", express.static(path.join(rootDir, "wp-includes")));

// Page folders that exist in this export
const pageDirs = [
  "about-the-resort",
  "check-availability",
  "contact",
  "local-activities",
  "news",
  "restaurants-bars",
  "room",
  "room-search-results",
  "spa-wellness",
  "stay",
  "2025",
  "2026"
];
for (const dir of pageDirs) {
  app.use(`/${dir}`, express.static(path.join(rootDir, dir)));
}

// --- Public API for client-side CMS injection ---
app.get("/api/public/settings", async (_req, res) => {
  try {
    const settings = await getPublicSettings();
    res.json({
      ...settings,
      emailMailto: `mailto:${settings.emailAddress}`
    });
  } catch (e) {
    res.status(500).json({ error: "Failed to load settings" });
  }
});

// --- Public Rooms API (used by stay page JS) ---
app.get("/api/rooms", async (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const rooms = await listRooms();
  res.json({
    rooms: rooms.map((r) => ({
      slug: r.slug,
      name: r.name,
      size: r.size || "",
      guests: 2,
      bed: r.bed || "",
      bathroom: r.bathroom || "",
      description: r.description,
      images: r.images.map((img) => img.url),
      status: "ACTIVE"
    }))
  });
});

app.get("/api/public/rooms", async (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const rooms = await listRooms();
  res.json({
    rooms: rooms.map((r) => ({
      slug: r.slug,
      name: r.name,
      size: r.size || "",
      guests: 2,
      bed: r.bed || "",
      bathroom: r.bathroom || "",
      description: r.description,
      included: r.included,
      images: r.images.map((img) => ({ url: img.url, alt: img.alt || "" }))
    }))
  });
});

app.get("/api/public/room/:slug", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const slug = String(req.params.slug || "").toLowerCase();
  const rooms = await listRooms();
  const r = rooms.find((x) => x.slug === slug);
  if (!r) return res.status(404).json({ error: "Not found" });
  res.json({
    room: {
      slug: r.slug,
      name: r.name,
      size: r.size || "",
      guests: 2,
      bed: r.bed || "",
      bathroom: r.bathroom || "",
      description: r.description,
      included: r.included,
      images: r.images.map((img) => ({ url: img.url, alt: img.alt || "" }))
    }
  });
});

// --- Admin ---
app.get("/loginDN", (req, res) => {
  let message = null;
  if (req.query.error) message = "Invalid credentials";
  if (req.query.db) message = "Database is not ready. Please check Railway Postgres + DATABASE_URL and redeploy.";
  res.render("login", { error: message });
});

app.post("/loginDN", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  try {
    const user = await verifyLogin(email, password);
    if (!user) return res.redirect("/loginDN?error=1");
    req.session.admin = { id: user.id, email: user.email };
    res.redirect("/admin");
  } catch (_e) {
    res.redirect("/loginDN?db=1");
  }
});

app.post("/admin/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/loginDN"));
});

// Backward-compatible redirect (old login route)
app.get("/admin/login", (_req, res) => res.redirect(301, "/loginDN"));

app.get("/admin", requireAdmin, async (_req, res) => {
  try {
    const settings = await getPublicSettings();
    res.render("admin", { settings, errors: null, saved: false });
  } catch (e) {
    res.status(500).send("Admin unavailable: database not ready.");
  }
});

app.post("/admin/settings", requireAdmin, async (req, res) => {
  const raw = {
    siteName: req.body.siteName,
    heroTitle: req.body.heroTitle,
    heroNoteTitle: req.body.heroNoteTitle,
    heroNoteBody: req.body.heroNoteBody,
    hotlineLabel: req.body.hotlineLabel,
    hotlineNumber: req.body.hotlineNumber,
    emailAddress: req.body.emailAddress,
    social: {
      facebook: req.body.facebook,
      twitter: req.body.twitter,
      pinterest: req.body.pinterest,
      youtube: req.body.youtube,
      instagram: req.body.instagram
    },
    copyrightText: req.body.copyrightText
  };

  const parsed = PublicSettingsSchema.safeParse(raw);
  if (!parsed.success) {
    try {
      const settings = await getPublicSettings();
      return res.status(400).render("admin", {
        settings: { ...settings, ...raw },
        errors: parsed.error.flatten(),
        saved: false
      });
    } catch (e) {
      return res.status(500).send("Admin unavailable: database not ready.");
    }
  }

  try {
    const settings = await upsertPublicSettings(parsed.data);
    res.render("admin", { settings, errors: null, saved: true });
  } catch (e) {
    res.status(500).send("Failed to save settings: database not ready.");
  }
});

app.get("/healthz", (_req, res) => res.json({ ok: true }));

// --- Media (DB-backed uploads) ---
app.get("/media/:id", async (req, res) => {
  const id = String(req.params.id || "");
  const media = await getMediaById(id);
  if (!media) return res.status(404).send("Not found");
  res.setHeader("Content-Type", media.mimeType);
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.send(Buffer.from(media.bytes));
});

app.post("/admin/media/upload", requireAdmin, (req, res) => {
  const bb = Busboy({ headers: req.headers, limits: { files: 1, fileSize: 8 * 1024 * 1024 } }); // 8MB

  let mimeType = "";
  let chunks = [];
  let total = 0;
  let handled = false;

  bb.on("file", (_name, file, info) => {
    handled = true;
    mimeType = info.mimeType || "application/octet-stream";
    file.on("data", (d) => {
      chunks.push(d);
      total += d.length;
    });
    file.on("limit", () => {
      chunks = [];
      total = 0;
    });
  });

  bb.on("finish", async () => {
    if (!handled || total === 0) return res.status(400).json({ error: "No file" });
    if (!/^image\/(jpeg|png|webp)$/.test(mimeType)) {
      return res.status(400).json({ error: "Only jpeg/png/webp allowed" });
    }
    try {
      const bytes = Buffer.concat(chunks);
      const media = await createMedia({ bytes, mimeType });
      res.json({ url: `/media/${media.id}` });
    } catch (e) {
      res.status(500).json({ error: "Upload failed" });
    }
  });

  req.pipe(bb);
});

// --- Rooms (CRUD) ---
app.get("/admin/rooms", requireAdmin, async (_req, res) => {
  const rooms = await listRooms();
  res.render("rooms", { rooms });
});

app.get("/admin/rooms/new", requireAdmin, (_req, res) => {
  res.render("room-form", {
    mode: "create",
    room: null,
    errors: null
  });
});

app.post("/admin/rooms", requireAdmin, async (req, res) => {
  const input = normalizeRoomInput(req.body);
  const parsed = RoomCategoryInputSchema.safeParse(input);
  if (!parsed.success) {
    return res.status(400).render("room-form", {
      mode: "create",
      room: input,
      errors: parsed.error.flatten()
    });
  }

  try {
    await createRoom(parsed.data);
    res.redirect("/admin/rooms");
  } catch (e) {
    return res.status(400).render("room-form", {
      mode: "create",
      room: input,
      errors: { formErrors: ["Failed to create room. Slug may already exist."], fieldErrors: {} }
    });
  }
});

app.get("/admin/rooms/:id/edit", requireAdmin, async (req, res) => {
  const room = await getRoomById(req.params.id);
  if (!room) return res.status(404).send("Room not found");
  res.render("room-form", {
    mode: "edit",
    room: {
      id: room.id,
      slug: room.slug,
      name: room.name,
      size: room.size || "",
      bed: room.bed || "",
      bathroom: room.bathroom || "",
      description: room.description,
      included: room.included,
      images: room.images.map((img) => ({ url: img.url, alt: img.alt || "" }))
    },
    errors: null
  });
});

app.post("/admin/rooms/:id", requireAdmin, async (req, res) => {
  const input = normalizeRoomInput(req.body);
  const parsed = RoomCategoryInputSchema.safeParse(input);
  if (!parsed.success) {
    return res.status(400).render("room-form", {
      mode: "edit",
      room: { id: req.params.id, ...input },
      errors: parsed.error.flatten()
    });
  }

  try {
    await updateRoom(req.params.id, parsed.data);
    res.redirect("/admin/rooms");
  } catch (e) {
    return res.status(400).render("room-form", {
      mode: "edit",
      room: { id: req.params.id, ...input },
      errors: { formErrors: ["Failed to update room. Slug may already exist."], fieldErrors: {} }
    });
  }
});

app.post("/admin/rooms/:id/delete", requireAdmin, async (req, res) => {
  await deleteRoom(req.params.id);
  res.redirect("/admin/rooms");
});

// --- Public room details (DB-backed fallback) ---
app.get("/room/:slug/", async (req, res, next) => {
  // If a static file exists, static middleware already served it.
  const slug = String(req.params.slug || "").toLowerCase();
  try {
    const rooms = await listRooms();
    const room = rooms.find((r) => r.slug === slug);
    if (!room) return next();
    res.render("room-public", {
      room: {
        slug: room.slug,
        name: room.name,
        size: room.size || "",
        guests: 2,
        bed: room.bed || "",
        bathroom: room.bathroom || "",
        description: room.description,
        included: room.included.split("\n").map((x) => x.trim()).filter(Boolean),
        images: room.images.map((img) => ({ url: img.url, alt: img.alt || "" }))
      }
    });
  } catch {
    return next();
  }
});

// --- Public root ---
// Root HTML is served via the HTML injection middleware above.

// Final error handler (avoid blank 500)
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  // eslint-disable-next-line no-console
  console.error(err);
  res.status(500).send("Internal Server Error");
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on :${port}`);
});

