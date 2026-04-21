import { z } from "zod";
import { getPrisma } from "./db.js";

export const PublicSettingsSchema = z.object({
  siteName: z.string().min(1).max(200),
  heroTitle: z.string().min(1).max(200),
  heroNoteTitle: z.string().min(1).max(200),
  heroNoteBody: z.string().min(1).max(2000),
  hotlineLabel: z.string().min(1).max(100),
  hotlineNumber: z.string().min(1).max(100),
  emailAddress: z.string().email().max(200),
  aboutHeroSubtitle: z.string().min(1).max(200),
  aboutHeroTitle: z.string().min(1).max(200),
  aboutHeroCounter1Label: z.string().min(1).max(120),
  aboutHeroCounter1Value: z.coerce.number().int().min(0).max(9999),
  aboutHeroCounter2Label: z.string().min(1).max(120),
  aboutHeroCounter2Value: z.coerce.number().int().min(0).max(9999),
  aboutHeroCounter3Label: z.string().min(1).max(120),
  aboutHeroCounter3Value: z.coerce.number().int().min(0).max(9999),
  aboutHeroCounter4Label: z.string().min(1).max(120),
  aboutHeroCounter4Value: z.coerce.number().int().min(0).max(9999),
  social: z.object({
    facebook: z.string().url().optional().or(z.literal("")),
    twitter: z.string().url().optional().or(z.literal("")),
    pinterest: z.string().url().optional().or(z.literal("")),
    youtube: z.string().url().optional().or(z.literal("")),
    instagram: z.string().url().optional().or(z.literal(""))
  }),
  copyrightText: z.string().min(1).max(300)
});

const DEFAULT_PUBLIC_SETTINGS = {
  siteName: "Tamcoc Oasis",
  heroTitle: "TAMCOC OASIS",
  heroNoteTitle: "ATTENTION!",
  heroNoteBody: "We only accept room bookings through our official channels",
  hotlineLabel: "Zalo/Hotline",
  hotlineNumber: "036 308 7 803",
  emailAddress: "info@tamcocoasis.com",
  aboutHeroSubtitle: "Enjoy Your Stay At The Hotel",
  aboutHeroTitle:
    "Spend your comfortable holiday in the heart of the beautiful South Pacific",
  aboutHeroCounter1Label: "Premium Rooms",
  aboutHeroCounter1Value: 72,
  aboutHeroCounter2Label: "Deluxe Suites",
  aboutHeroCounter2Value: 20,
  aboutHeroCounter3Label: "Private Chalets",
  aboutHeroCounter3Value: 12,
  aboutHeroCounter4Label: "Restaurants",
  aboutHeroCounter4Value: 6,
  social: {
    facebook: "",
    twitter: "",
    pinterest: "",
    youtube: "",
    instagram: ""
  },
  copyrightText: "© Copyright TamCoc Oasis"
};

const DEFAULT_KEYS = Object.keys(PublicSettingsSchema.shape);

export async function getPublicSettings() {
  const prisma = getPrisma();
  const rows = await prisma.siteSetting.findMany({
    where: { key: { in: DEFAULT_KEYS } }
  });
  const obj = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  // Backward-compatible: tolerate missing keys when schema evolves.
  return PublicSettingsSchema.parse({ ...DEFAULT_PUBLIC_SETTINGS, ...obj });
}

export async function upsertPublicSettings(input) {
  const prisma = getPrisma();
  const parsed = PublicSettingsSchema.parse(input);
  const entries = Object.entries(parsed);

  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.siteSetting.upsert({
        where: { key },
        update: { value },
        create: { key, value }
      })
    )
  );

  return parsed;
}

