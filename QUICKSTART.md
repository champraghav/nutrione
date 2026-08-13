# Quick Start

## Fastest path: Docker Compose + local frontend

Requires [Docker](https://docs.docker.com/get-docker/) and [Node.js 20+](https://nodejs.org/).

```bash
git clone https://github.com/champraghav/nutrione.git
cd nutrione
git checkout claude/new-session-q5n63o

# 1. Start Postgres, Redis, and build+start the API
docker compose up -d --build postgres redis api

# 2. Initialize the database (tables + seed foods/exercises)
docker compose exec api npm run migrate:prod
docker compose exec api npm run seed:prod

# 3. Run the frontend (no Docker service for this yet — plain Vite dev server)
cd web
npm install
npm run dev
```

Visit **http://localhost:5173**, click **Sign up**, and create an account —
there's no pre-seeded user, so you're creating a fresh one. The health score
and history charts will look empty until you log a meal, a workout, and a
night of sleep; the app is designed to make sense the moment you do.

To stop everything: `docker compose down` (add `-v` to also wipe the database).

### Optional: AI coach

The AI Coach page works without this — it just shows a friendly
"unavailable" message. To make it actually respond:

```bash
docker compose up -d ollama
docker exec health-os-ollama ollama pull mistral
```

---

## Alternative: fully manual (no Docker)

If you'd rather not use Docker, install Postgres 14+ and Redis yourself,
then:

```bash
cd backend
cp .env.example .env   # edit DATABASE_URL / REDIS_URL if not using defaults
npm install
npm run migrate
npm run seed
npm run dev
```

```bash
# separate terminal
cd web
npm install
npm run dev
```

## Poking the API directly

```bash
curl -X POST http://localhost:3000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"password123"}'

# copy the accessToken from the response
curl http://localhost:3000/api/v1/users/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

Full endpoint reference: `docs/API.md`.
