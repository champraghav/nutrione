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
there's no pre-seeded user, so you're creating a fresh one.

Signing up drops you into a three-step setup: your body stats, what you're
trying to do with your weight, and the plan it works out from those. That is
what turns the calorie target from a generic 2,000 into your number, so it's
worth the thirty seconds — but every step has **Skip for now** if you'd rather
just look around.

The history charts stay empty until you log a meal, a workout and a night of
sleep. The health score is deliberately blank rather than low until then: it
scores what you log, so with nothing logged there is nothing to score.

To stop everything: `docker compose down` (add `-v` to also wipe the database).

### Installing it to a phone

Health OS is a progressive web app: opened over HTTPS, a phone browser offers
"Add to Home Screen", after which it launches without browser chrome. A service
worker caches the interface, so it opens with no connection at all — and meals,
water, steps and habit ticks logged offline are held and sent the moment you
reconnect. A banner says how many are waiting. Nothing is lost in a basement
restaurant or on the Underground.

The app shell is cached; your health data never is. Stale totals shown as
though they were current would be worse than an honest "couldn't load" — you
would log a meal against yesterday's numbers without noticing.

### Optional: plate photo scanning

Scanning a photo of your meal to identify the foods on it needs an Anthropic
API key. Without one, the button still appears and explains it isn't
configured — search and barcode logging work regardless.

Add to `backend/.env` (or the `api` service's environment in
`docker-compose.yml`):

```
ANTHROPIC_API_KEY=sk-ant-...
```

Get a key at https://console.anthropic.com/settings/keys.

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
