-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'OFFICE_STAFF', 'EXECUTIVE');

-- CreateTable: executives (no FK deps – created first)
CREATE TABLE "executives" (
    "id"        UUID    NOT NULL DEFAULT gen_random_uuid(),
    "name"      TEXT    NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "executives_pkey" PRIMARY KEY ("id")
);

-- CreateTable: users
CREATE TABLE "users" (
    "id"            UUID        NOT NULL DEFAULT gen_random_uuid(),
    "name"          TEXT        NOT NULL,
    "username"      TEXT        NOT NULL,
    "password_hash" TEXT        NOT NULL,
    "role"          "Role"      NOT NULL DEFAULT 'OFFICE_STAFF',
    "is_active"     BOOLEAN     NOT NULL DEFAULT true,
    "executive_id"  UUID,
    "created_at"    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable: routes
CREATE TABLE "routes" (
    "id"           UUID    NOT NULL DEFAULT gen_random_uuid(),
    "route_number" TEXT    NOT NULL,
    "description"  TEXT,
    "is_active"    BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable: checkouts
CREATE TABLE "checkouts" (
    "id"                  UUID        NOT NULL DEFAULT gen_random_uuid(),
    "invoice_number"      TEXT        NOT NULL,
    "executive_id"        UUID        NOT NULL,
    "route_id"            UUID        NOT NULL,
    "out_datetime"        TIMESTAMPTZ NOT NULL,
    "out_by_user_id"      UUID        NOT NULL,
    "in_datetime"         TIMESTAMPTZ,
    "in_by_user_id"       UUID,
    "voided"              BOOLEAN     NOT NULL DEFAULT false,
    "void_reason"         TEXT,
    "voided_by_user_id"   UUID,
    "voided_at"           TIMESTAMPTZ,
    "created_at"          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "checkouts_pkey" PRIMARY KEY ("id")
);

-- Unique indexes
CREATE UNIQUE INDEX "users_username_key"       ON "users"("username");
CREATE UNIQUE INDEX "routes_route_number_key"  ON "routes"("route_number");

-- *** Key constraint: at most ONE active checkout per invoice_number ***
-- (active = not returned AND not voided)
CREATE UNIQUE INDEX "checkouts_active_invoice_unique"
    ON "checkouts"("invoice_number")
    WHERE ("in_datetime" IS NULL AND "voided" = false);

-- Foreign keys: users → executives
ALTER TABLE "users"
    ADD CONSTRAINT "users_executive_id_fkey"
    FOREIGN KEY ("executive_id") REFERENCES "executives"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign keys: checkouts → executives
ALTER TABLE "checkouts"
    ADD CONSTRAINT "checkouts_executive_id_fkey"
    FOREIGN KEY ("executive_id") REFERENCES "executives"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Foreign keys: checkouts → routes
ALTER TABLE "checkouts"
    ADD CONSTRAINT "checkouts_route_id_fkey"
    FOREIGN KEY ("route_id") REFERENCES "routes"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Foreign keys: checkouts → users (out_by, in_by, voided_by)
ALTER TABLE "checkouts"
    ADD CONSTRAINT "checkouts_out_by_user_id_fkey"
    FOREIGN KEY ("out_by_user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "checkouts"
    ADD CONSTRAINT "checkouts_in_by_user_id_fkey"
    FOREIGN KEY ("in_by_user_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "checkouts"
    ADD CONSTRAINT "checkouts_voided_by_user_id_fkey"
    FOREIGN KEY ("voided_by_user_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
