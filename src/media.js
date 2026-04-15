import { getPrisma } from "./db.js";

export async function createMedia({ bytes, mimeType }) {
  const prisma = getPrisma();
  return prisma.media.create({
    data: {
      bytes,
      mimeType
    }
  });
}

export async function getMediaById(id) {
  const prisma = getPrisma();
  return prisma.media.findUnique({ where: { id } });
}

