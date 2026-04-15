import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL || "admin@example.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "admin12345";

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  await prisma.adminUser.upsert({
    where: { email: adminEmail },
    update: { passwordHash },
    create: { email: adminEmail, passwordHash },
  });

  const defaults = {
    siteName: "Tamcoc Oasis",
    heroTitle: "TAMCOC OASIS",
    heroNoteTitle: "ATTENTION!",
    heroNoteBody: "We only accept room bookings through our official channels",
    hotlineLabel: "Zalo/Hotline",
    hotlineNumber: "036 308 7 803",
    emailAddress: "info@tamcocoasis.com",
    social: {
      facebook: "https://www.facebook.com/",
      twitter: "https://www.twitter.com/",
      pinterest: "https://www.pinterest.com/",
      youtube: "https://www.youtube.com/",
      instagram: "https://www.instagram.com/"
    },
    copyrightText: "© Copyright TamCoc Oasis",
  };

  for (const [key, value] of Object.entries(defaults)) {
    await prisma.siteSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  // Optional seed: a sample Deluxe room (only if not exists)
  const deluxeSlug = "deluxe";
  const existingDeluxe = await prisma.roomCategory.findUnique({ where: { slug: deluxeSlug } });
  if (!existingDeluxe) {
    await prisma.roomCategory.create({
      data: {
        slug: deluxeSlug,
        name: "Deluxe",
        size: "45 m²",
        bed: "1 King bed",
        bathroom: "1 bathroom",
        description:
          "Nestled amidst the resort’s lush gardens, the Deluxe room offers a calm retreat with elegant finishes and natural light.",
        included: ["Private balcony", "140x200 cm Elite bed", "Air conditioning", "Free Wi‑Fi"].join("\n"),
        images: {
          create: Array.from({ length: 6 }, (_, i) => ({
            sortOrder: i,
            url: `/assets/room-concepts/deluxe-${i + 1}.jpg`,
            alt: "Deluxe concept image"
          }))
        }
      }
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

