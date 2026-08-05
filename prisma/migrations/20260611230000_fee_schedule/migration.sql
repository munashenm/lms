-- CreateTable
CREATE TABLE "fee_schedule_items" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fee_schedule_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fee_schedule_items_schoolId_isActive_sortOrder_idx" ON "fee_schedule_items"("schoolId", "isActive", "sortOrder");

-- AddForeignKey
ALTER TABLE "fee_schedule_items" ADD CONSTRAINT "fee_schedule_items_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
