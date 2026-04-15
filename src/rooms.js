import { z } from "zod";
import { getPrisma } from "./db.js";

export const RoomImageInputSchema = z.object({
  url: z.string().min(1).max(2000),
  alt: z.string().max(300).optional().or(z.literal(""))
});

export const RoomCategoryInputSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be kebab-case (a-z, 0-9, -)"),
  name: z.string().min(1).max(200),
  size: z.string().max(100).optional().or(z.literal("")),
  bed: z.string().max(200).optional().or(z.literal("")),
  bathroom: z.string().max(200).optional().or(z.literal("")),
  description: z.string().min(1).max(10000),
  included: z.string().min(1).max(10000),
  images: z.array(RoomImageInputSchema).length(6, "Exactly 6 concept images are required.")
});

export function normalizeRoomInput(raw) {
  const images = Array.from({ length: 6 }, (_, idx) => {
    const i = idx + 1;
    return {
      url: raw[`image${i}Url`] ?? "",
      alt: raw[`image${i}Alt`] ?? ""
    };
  });

  return {
    slug: String(raw.slug || "").trim().toLowerCase(),
    name: String(raw.name || "").trim(),
    size: String(raw.size || "").trim(),
    bed: String(raw.bed || "").trim(),
    bathroom: String(raw.bathroom || "").trim(),
    description: String(raw.description || "").trim(),
    included: String(raw.included || "").trim(),
    images: images.map((img) => ({ url: String(img.url || "").trim(), alt: String(img.alt || "").trim() }))
  };
}

export async function listRooms() {
  const prisma = getPrisma();
  return prisma.roomCategory.findMany({
    orderBy: { createdAt: "desc" },
    include: { images: { orderBy: { sortOrder: "asc" } } }
  });
}

export async function getRoomById(id) {
  const prisma = getPrisma();
  return prisma.roomCategory.findUnique({
    where: { id },
    include: { images: { orderBy: { sortOrder: "asc" } } }
  });
}

export async function createRoom(input) {
  const prisma = getPrisma();
  const parsed = RoomCategoryInputSchema.parse(input);

  return prisma.roomCategory.create({
    data: {
      slug: parsed.slug,
      name: parsed.name,
      size: parsed.size || null,
      bed: parsed.bed || null,
      bathroom: parsed.bathroom || null,
      description: parsed.description,
      included: parsed.included,
      images: {
        create: parsed.images.map((img, idx) => ({
          sortOrder: idx,
          url: img.url,
          alt: img.alt || null
        }))
      }
    },
    include: { images: { orderBy: { sortOrder: "asc" } } }
  });
}

export async function updateRoom(id, input) {
  const prisma = getPrisma();
  const parsed = RoomCategoryInputSchema.parse(input);

  return prisma.roomCategory.update({
    where: { id },
    data: {
      slug: parsed.slug,
      name: parsed.name,
      size: parsed.size || null,
      bed: parsed.bed || null,
      bathroom: parsed.bathroom || null,
      description: parsed.description,
      included: parsed.included,
      images: {
        deleteMany: {},
        create: parsed.images.map((img, idx) => ({
          sortOrder: idx,
          url: img.url,
          alt: img.alt || null
        }))
      }
    },
    include: { images: { orderBy: { sortOrder: "asc" } } }
  });
}

export async function deleteRoom(id) {
  const prisma = getPrisma();
  // images cascade delete
  return prisma.roomCategory.delete({ where: { id } });
}

