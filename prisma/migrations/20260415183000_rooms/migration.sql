-- CreateTable
CREATE TABLE "RoomCategory" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "size" TEXT,
    "bed" TEXT,
    "bathroom" TEXT,
    "description" TEXT NOT NULL,
    "included" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RoomCategory_slug_key" ON "RoomCategory"("slug");

-- CreateTable
CREATE TABLE "RoomImage" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "alt" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RoomImage_roomId_sortOrder_key" ON "RoomImage"("roomId", "sortOrder");

-- AddForeignKey
ALTER TABLE "RoomImage" ADD CONSTRAINT "RoomImage_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "RoomCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

