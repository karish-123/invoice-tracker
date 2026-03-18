-- Add payment received fields to checkouts table
ALTER TABLE "checkouts"
    ADD COLUMN "payment_received"            BOOLEAN     NOT NULL DEFAULT false,
    ADD COLUMN "payment_received_at"         TIMESTAMPTZ,
    ADD COLUMN "payment_received_by_user_id" UUID;

ALTER TABLE "checkouts"
    ADD CONSTRAINT "checkouts_payment_received_by_user_id_fkey"
    FOREIGN KEY ("payment_received_by_user_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
