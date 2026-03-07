#!/bin/sh
set -e

echo ">>> Running database migrations..."
./node_modules/.bin/prisma migrate deploy

echo ">>> Seeding database..."
./node_modules/.bin/tsx prisma/seed.ts

echo ">>> Starting API server..."
exec "$@"
