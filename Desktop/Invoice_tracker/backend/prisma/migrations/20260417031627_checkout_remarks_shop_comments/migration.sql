-- CreateEnum
CREATE TYPE "CommentEntityType" AS ENUM ('CHECKOUT', 'FIELD_REPORT', 'APPROVAL_REQUEST', 'SHOP');

-- AlterTable
ALTER TABLE "checkouts" ADD COLUMN     "remarks" TEXT,
ADD COLUMN     "shop_id" UUID;

-- CreateTable
CREATE TABLE "comments" (
    "id" UUID NOT NULL,
    "entity_type" "CommentEntityType" NOT NULL,
    "entity_id" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "comments_entity_type_entity_id_idx" ON "comments"("entity_type", "entity_id");

-- AddForeignKey
ALTER TABLE "checkouts" ADD CONSTRAINT "checkouts_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
