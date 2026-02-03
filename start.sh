#!/bin/sh
set -e

echo "Initializing database..."
bun run scripts/init-db.ts

echo "Starting server (API + reminder scheduler)..."
bun run src/server.ts
