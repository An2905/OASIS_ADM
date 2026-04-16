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

  // Default room categories (from existing public pages)
  const defaultRooms = [
    {
      slug: "deluxe",
      name: "Deluxe",
      size: "30–35 m²",
      bed: "2 Single Beds",
      bathroom: "1 Bathroom",
      description:
        "Nestled amidst the resort’s lush gardens, the Deluxe Room offers a tranquil escape surrounded by the soothing sounds of nature. With a size of 30–35m², each room is thoughtfully designed for comfort and relaxation, featuring warm wooden touches and soft natural light.",
      included: [
        "Private balcony",
        "140x200 cm Elite bed",
        "Upholstered seat beside the panoramic window",
        "TV-UHD screen for watching mountaineering films",
        "Writing desk with USB ports for documenting your adventures",
        "Room safe for your top mountain photos"
      ].join("\n"),
      images: [
        "/wp-content/uploads/2023/05/DSC02700.jpg",
        "/wp-content/uploads/2023/05/DSC02694.jpg",
        "/wp-content/uploads/2023/05/DSC02706.jpg",
        "/wp-content/uploads/2023/05/JBN03548.jpg",
        "/wp-content/uploads/2023/05/DSC02659-Large.jpg",
        "/wp-content/uploads/2023/05/DSC02647.jpg"
      ]
    },
    {
      slug: "deluxe-executive",
      name: "Grand Deluxe",
      size: "40 m²",
      bed: "1 King Bed",
      bathroom: "1 Bathroom",
      description:
        "Spacious and refined at 40m², the Grand Deluxe Room embodies the essence of relaxation. Framed by views of mountains and the pool, it offers a harmonious blend of nature and modern design.",
      included: [
        "Private balcony",
        "2m x 2.2m bed",
        "Soaking tub",
        "Air conditioning",
        "Free Wi‑Fi",
        "Cable TV"
      ].join("\n"),
      images: [
        "/wp-content/uploads/2023/05/DSC02584-Large-1.jpg",
        "/wp-content/uploads/2023/05/JBN03548-Large-1.jpg",
        "/wp-content/uploads/2023/05/DSC02614-Large.jpg",
        "/wp-content/uploads/2023/05/DSC02668-Large.jpg",
        "/wp-content/uploads/2023/05/DSC02593.jpg",
        "/wp-content/uploads/2023/05/DSC02593-Large.jpg"
      ]
    },
    {
      slug: "premier-deluxe",
      name: "Premier Deluxe",
      size: "30–35 m²",
      bed: "1 King Bed",
      bathroom: "1 Bathroom",
      description:
        "The Premium Deluxe combines modern comfort with the refreshing beauty of Ninh Binh’s landscapes. Overlooking the majestic limestone mountains and the resort’s sparkling pool, this 30–35m² room invites guests to unwind in an elegant, nature-inspired space.",
      included: [
        "Mountain & pool view",
        "Private balcony",
        "Air conditioning",
        "Free Wi‑Fi",
        "Cable TV",
        "In-room refrigerator"
      ].join("\n"),
      images: [
        "/wp-content/uploads/2023/05/DSC02700-Large.jpg",
        "/wp-content/uploads/2023/05/DSC02638-Large.jpg",
        "/wp-content/uploads/2023/05/DSC02644-Large.jpg",
        "/wp-content/uploads/2023/05/DSC02750-Large.jpg",
        "/wp-content/uploads/2023/05/JBN03548-Large-2.jpg",
        "/wp-content/uploads/2023/05/JBN03628-Large-1.jpg"
      ]
    },
    {
      slug: "deluxe-bungalow",
      name: "Deluxe Bungalow",
      size: "60 m²",
      bed: "1 King Bed",
      bathroom: "1 Bathroom",
      description:
        "A charming bungalow-style retreat with generous space and a relaxing atmosphere—ideal for guests who want extra privacy and comfort during their stay.",
      included: [
        "Private outdoor area",
        "Air conditioning",
        "Free Wi‑Fi",
        "Cable TV",
        "Hair dryer",
        "Towels"
      ].join("\n"),
      images: [
        "/wp-content/uploads/2023/05/DSC03026-Large.jpg",
        "/wp-content/uploads/2023/05/DSC03002-Large.jpg",
        "/wp-content/uploads/2023/05/DSC03011-Large.jpg",
        "/wp-content/uploads/2023/05/DSC03015-Large.jpg",
        "/wp-content/uploads/2023/05/DSC03018-Large.jpg",
        "/wp-content/uploads/2023/05/DSC03019-Large.jpg"
      ]
    }
  ];

  for (const r of defaultRooms) {
    const existing = await prisma.roomCategory.findUnique({ where: { slug: r.slug } });
    if (existing) continue;

    await prisma.roomCategory.create({
      data: {
        slug: r.slug,
        name: r.name,
        size: r.size,
        bed: r.bed,
        bathroom: r.bathroom,
        description: r.description,
        included: r.included,
        images: {
          create: r.images.slice(0, 6).map((url, i) => ({
            sortOrder: i,
            url,
            alt: `${r.name} concept image`
          }))
        }
      }
    });
  }

  // Repair: some deployments may have "deluxe" images pointing to non-existent local assets.
  // If so, reset them back to known-good wp-content images.
  const deluxe = await prisma.roomCategory.findUnique({
    where: { slug: "deluxe" },
    include: { images: { orderBy: { sortOrder: "asc" } } }
  });
  if (deluxe) {
    const hasBrokenLocal = (deluxe.images || []).some((img) =>
      String(img.url || "").startsWith("/assets/room-concepts/")
    );
    if (hasBrokenLocal) {
      const fallback = defaultRooms.find((r) => r.slug === "deluxe");
      if (fallback) {
        await prisma.roomCategory.update({
          where: { id: deluxe.id },
          data: {
            images: {
              deleteMany: {},
              create: fallback.images.slice(0, 6).map((url, i) => ({
                sortOrder: i,
                url,
                alt: `${fallback.name} concept image`
              }))
            }
          }
        });
      }
    }
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

