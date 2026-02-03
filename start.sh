#!/bin/sh
set -e

echo "Initializing database..."
bun run scripts/init-db.ts

echo "Starting services..."
bun run src/scheduler.ts &
bun run src/server.ts
