-- CreateEnum
CREATE TYPE "FieldReportStatus" AS ENUM ('VISITED', 'ORDER_DONE', 'PAYMENT_DONE', 'ORDER_PAYMENT_DONE', 'NEW_SHOP');

-- CreateEnum
CREATE TYPE "FieldReportRemark" AS ENUM ('WITH_STAND', 'URGENT', 'PAYMENT_ON_DELIVERY', 'IMMEDIATE_PAYMENT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "FieldReportApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- DropForeignKey
ALTER TABLE "checkouts" DROP CONSTRAINT "checkouts_executive_id_fkey";

-- DropIndex
DROP INDEX "approval_requests_requester_idx";

-- DropIndex
DROP INDEX "approval_requests_status_idx";

-- AlterTable
ALTER TABLE "approval_requests" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "checkouts" ADD COLUMN     "field_report_id" UUID,
ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "executives" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "routes" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "id" DROP DEFAULT;

-- CreateTable
CREATE TABLE "shops" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "route_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_reports" (
    "id" UUID NOT NULL,
    "route_id" UUID NOT NULL,
    "shop_id" UUID,
    "new_shop_name" TEXT,
    "status" "FieldReportStatus" NOT NULL,
    "appr_value" DECIMAL(12,2),
    "remark" "FieldReportRemark" NOT NULL,
    "custom_remark" TEXT,
    "order_taken_by" TEXT NOT NULL,
    "visit_date" DATE NOT NULL,
    "executive_id" UUID NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approval_status" "FieldReportApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by_user_id" UUID,
    "reviewed_at" TIMESTAMPTZ,
    "review_remark" TEXT,

    CONSTRAINT "field_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shops_route_id_name_key" ON "shops"("route_id", "name");

-- CreateIndex
CREATE INDEX "field_reports_approval_status_idx" ON "field_reports"("approval_status");

-- CreateIndex
CREATE INDEX "field_reports_executive_id_idx" ON "field_reports"("executive_id");

-- RenameForeignKey
ALTER TABLE "approval_requests" RENAME CONSTRAINT "ar_requested_by_fkey" TO "approval_requests_requested_by_user_id_fkey";

-- RenameForeignKey
ALTER TABLE "approval_requests" RENAME CONSTRAINT "ar_reviewed_by_fkey" TO "approval_requests_reviewed_by_user_id_fkey";

-- AddForeignKey
ALTER TABLE "shops" ADD CONSTRAINT "shops_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkouts" ADD CONSTRAINT "checkouts_executive_id_fkey" FOREIGN KEY ("executive_id") REFERENCES "executives"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkouts" ADD CONSTRAINT "checkouts_field_report_id_fkey" FOREIGN KEY ("field_report_id") REFERENCES "field_reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_reports" ADD CONSTRAINT "field_reports_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_reports" ADD CONSTRAINT "field_reports_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_reports" ADD CONSTRAINT "field_reports_executive_id_fkey" FOREIGN KEY ("executive_id") REFERENCES "executives"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_reports" ADD CONSTRAINT "field_reports_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_reports" ADD CONSTRAINT "field_reports_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
