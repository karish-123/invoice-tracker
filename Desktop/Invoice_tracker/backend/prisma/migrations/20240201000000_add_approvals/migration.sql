-- CreateEnum
CREATE TYPE "ApprovalRequestType" AS ENUM ('CHECKOUT_BACKDATE', 'RETURN_BACKDATE');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "approval_requests" (
    "id"                    UUID         NOT NULL DEFAULT gen_random_uuid(),
    "request_type"          "ApprovalRequestType" NOT NULL,
    "requested_by_user_id"  UUID         NOT NULL,
    "requested_at"          TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status"                "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by_user_id"   UUID,
    "reviewed_at"           TIMESTAMPTZ,
    "review_reason"         TEXT,
    "payload"               JSONB        NOT NULL,

    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "ar_requested_by_fkey"
    FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "ar_reviewed_by_fkey"
    FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "approval_requests_status_idx"    ON "approval_requests"("status");
CREATE INDEX "approval_requests_requester_idx" ON "approval_requests"("requested_by_user_id");
