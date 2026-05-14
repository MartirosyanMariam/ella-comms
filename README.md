# Ella Communication Engine

Internal rule-based notification system for the Ella language learning app.

## Local development

```bash
cp .env.example .env   # already pre-filled for Docker
docker compose up --build
```

| Service | URL |
|---|---|
| Admin UI | http://localhost:3000 |
| Notification API | http://localhost:8000 |
| API docs | http://localhost:8000/docs |
| Mock backend | http://localhost:9000 |

## Deploy to Railway (free tier)

Railway gives $5 free credit monthly — enough to run all services.

### Steps

1. Push this repo to GitHub (done below).
2. Go to [railway.app](https://railway.app) → **New Project → Deploy from GitHub repo**.
3. Add these services one by one:

#### Service 1: `rules-db` (PostgreSQL)
- Add → **Database → PostgreSQL**
- Note the `DATABASE_URL` Railway generates → use as `RULES_DB_URL`

#### Service 2: `ella-mock-db` (PostgreSQL — simulates Ella's DB)
- Add → **Database → PostgreSQL**
- Note the `DATABASE_URL` → use as `ELLA_DB_URL`
- After deploy, run the seed SQL: Railway dashboard → this DB → **Query** → paste contents of `service/db/seed_ella_db.sql`

#### Service 3: `mock-backend`
- Add → **GitHub repo** → root directory: `mock-backend`
- Environment: none needed
- Railway auto-detects the Dockerfile

#### Service 4: `service` (notification service)
- Add → **GitHub repo** → root directory: `service`
- Environment variables:
  ```
  ELLA_DB_URL=<ella-mock-db DATABASE_URL>
  RULES_DB_URL=<rules-db DATABASE_URL>
  BACKEND_API_URL=https://<mock-backend-railway-domain>
  SCHEDULER_INTERVAL_MINUTES=15
  ```

#### Service 5: `frontend`
- Add → **GitHub repo** → root directory: `frontend`
- Build argument: `NEXT_PUBLIC_API_URL=https://<service-railway-domain>`

### Quick deploy script

After setting Railway env vars, trigger deploys via:
```bash
railway up
```

## Architecture

```
Browser → frontend (Next.js :3000)
             ↓ API calls
          service (FastAPI :8000)  ←── APScheduler (every 15 min)
         /          \
  rules-db        ella-mock-db
  (rules + log)   (users + events)
         \
          mock-backend (:9000)
          (simulates Ella's POST /api/v1/notifications/send)
```

## JSON payload contract

See [`shared/payload_schema.json`](shared/payload_schema.json) for the canonical schema sent to Ella's backend.
