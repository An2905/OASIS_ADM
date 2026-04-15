import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import session from "express-session";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";

import { requireAdmin, verifyLogin } from "./auth.js";
import { getPublicSettings, upsertPublicSettings, PublicSettingsSchema } from "./settings.js";

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

app.use(
  session({
    name: "oasis_admin",
    secret: process.env.SESSION_SECRET || "dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production"
    }
  })
);

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

// --- Admin ---
app.get("/admin/login", (req, res) => {
  let message = null;
  if (req.query.error) message = "Invalid credentials";
  if (req.query.db) message = "Database is not ready. Please check Railway Postgres + DATABASE_URL and redeploy.";
  res.render("login", { error: message });
});

app.post("/admin/login", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  try {
    const user = await verifyLogin(email, password);
    if (!user) return res.redirect("/admin/login?error=1");
    req.session.admin = { id: user.id, email: user.email };
    res.redirect("/admin");
  } catch (_e) {
    res.redirect("/admin/login?db=1");
  }
});

app.post("/admin/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/admin/login"));
});

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

// --- Public root ---
app.get("/", (_req, res) => {
  res.sendFile(path.join(rootDir, "index.html"));
});

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

