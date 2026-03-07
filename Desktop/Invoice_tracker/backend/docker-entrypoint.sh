#!/bin/sh
set -e

echo ">>> Running database migrations..."
./node_modules/.bin/prisma migrate deploy

echo ">>> Seeding database..."
node dist/seed/seed.js

echo ">>> Starting API server..."
exec "$@"
