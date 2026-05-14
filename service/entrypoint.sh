#!/bin/sh
set -e

echo "Running DB migrations and seeding rules…"
python -c "
import asyncio
from db.rules_db import run_migrations
asyncio.run(run_migrations())
print('Migrations done.')
"

python db/seed_rules.py

echo "Starting notification service…"
exec uvicorn main:app --host 0.0.0.0 --port 8000
