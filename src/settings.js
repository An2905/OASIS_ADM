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

const DEFAULT_KEYS = Object.keys(PublicSettingsSchema.shape);

export async function getPublicSettings() {
  const prisma = getPrisma();
  const rows = await prisma.siteSetting.findMany({
    where: { key: { in: DEFAULT_KEYS } }
  });
  const obj = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  // Let schema fill in validation errors early.
  return PublicSettingsSchema.parse(obj);
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

