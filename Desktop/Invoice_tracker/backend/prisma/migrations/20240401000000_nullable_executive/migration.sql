-- Make executive_id nullable to support master/pending invoices
-- (invoices recorded before being assigned to an executive)
ALTER TABLE "checkouts" ALTER COLUMN "executive_id" DROP NOT NULL;
