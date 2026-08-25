# Deploying Nutrione to Render

This guide walks through deploying the Nutrione health tracking app to Render.com using the free tier.

## Prerequisites

1. A [Render.com](https://render.com) account
2. GitHub repository access to `champraghav/nutrione` on the `claude/new-session-q5n63o` branch
3. (Optional but recommended) Anthropic API key for photo scanning feature

## Step 1: Create a Postgres Database

1. Log in to [Render Dashboard](https://dashboard.render.com)
2. Click **+ New** > **PostgreSQL**
3. Configure:
   - **Name**: `nutrione-db`
   - **Database**: `nutrione`
   - **User**: `nutrione`
   - **Region**: Choose closest to your users
   - **Plan**: Free (or paid if you want persistence)
4. Click **Create Database**
5. Wait for the database to initialize (2-3 minutes)
6. Copy the **Internal Database URL** from the dashboard (you'll need it for the API service)

## Step 2: Create a Redis Instance (Optional)

For production, Redis is used for session caching and rate limiting. Render's Redis is paid-only, so for the free tier:

**Option A: Use Render's free Redis with limited features**
1. Click **+ New** > **Redis**
2. Configure:
   - **Name**: `nutrione-redis`
   - **Region**: Same as your Postgres database
   - **Plan**: Free
3. Click **Create Redis**
4. Copy the **Internal Redis URL**

**Option B: Use UpStash Redis (free tier available)**
1. Sign up at [upstash.com](https://upstash.com)
2. Create a Redis database
3. Copy the connection string

**Option C: Skip Redis for MVP**
- The app will work with an in-memory store, but won't persist session data across restarts

## Step 3: Deploy the Backend API

1. In the Render Dashboard, click **+ New** > **Web Service**
2. Connect your GitHub repository:
   - Select `champraghav/nutrione`
   - Branch: `claude/new-session-q5n63o`
3. Configure:
   - **Name**: `nutrione-api`
   - **Runtime**: Node
   - **Build Command**: `cd backend && npm install && npm run build`
   - **Start Command**: `cd backend && npm run migrate:prod && npm run seed:prod && npm start`
   - **Plan**: Free
4. Under **Environment Variables**, add:

   ```
   NODE_ENV=production
   PORT=3000
   DATABASE_URL=<paste your Postgres Internal URL from Step 1>
   REDIS_URL=<paste your Redis Internal URL from Step 2 (or skip if using Option C)>
   JWT_ACCESS_SECRET=<generate a random string or let Render auto-generate>
   JWT_REFRESH_SECRET=<generate a random string or let Render auto-generate>
   JWT_ACCESS_EXPIRES_IN=15m
   JWT_REFRESH_EXPIRES_IN=30d
   CORS_ORIGIN=https://<your-frontend-domain>.onrender.com
   TRUST_PROXY_HOPS=1
   ANTHROPIC_API_KEY=<optional: your Anthropic API key from console.anthropic.com>
   VISION_MODEL=claude-sonnet-4-5-20250929
   OLLAMA_URL=
   OLLAMA_MODEL=
   ```

5. Click **Create Web Service**
6. Wait for the build and deployment to complete (3-5 minutes)
7. Copy your API URL (e.g., `https://nutrione-api.onrender.com`) for Step 4

## Step 4: Deploy the Frontend

1. In the Render Dashboard, click **+ New** > **Static Site**
2. Connect your GitHub repository (same as Step 3)
3. Configure:
   - **Name**: `nutrione-web`
   - **Branch**: `claude/new-session-q5n63o`
   - **Build Command**: `cd web && npm install && npm run build`
   - **Publish Directory**: `web/dist`
4. Under **Environment Variables**, add:

   ```
   VITE_API_URL=https://nutrione-api.onrender.com
   VITE_APP_NAME=Health OS
   ```

5. Click **Create Static Site**
6. Wait for the build to complete
7. Your app will be live at the URL shown in the dashboard (e.g., `https://nutrione-web.onrender.com`)

## Step 5: Update CORS Origin (if needed)

If the frontend URL from Step 4 differs from what you specified in Step 3, update the backend's `CORS_ORIGIN` environment variable:

1. Go to the **nutrione-api** service in the Render Dashboard
2. Click **Environment**
3. Edit `CORS_ORIGIN` to match your frontend URL
4. Click **Save Changes** (this will trigger a redeploy)

## Accessing Your App

Visit your frontend URL (from Step 4) to create an account and start using the app.

### Optional: Photo Scanning

To enable the photo-scanning feature for meal recognition:

1. Get an Anthropic API key at [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)
2. In the Render Dashboard, go to the **nutrione-api** service
3. Click **Environment**
4. Set `ANTHROPIC_API_KEY` to your key
5. Click **Save Changes**

The photo scanning endpoint will now be active.

### Optional: AI Coach

To enable the AI coach feature:

1. You'll need Ollama running with a model (e.g., Mistral)
   - For Render: You'd need a paid service or external Ollama server
   - For MVP: The AI coach gracefully disables itself if Ollama is unreachable
2. If using an external Ollama server, set `OLLAMA_URL` and `OLLAMA_MODEL` in the backend environment

## Troubleshooting

### Database Migration Errors

If the database migration fails on first deploy:

1. Go to the **nutrione-api** service
2. Click **Logs** to see error details
3. Manual steps:
   - SSH into the service (if available on your plan)
   - Run `npm run migrate:prod` manually

### Build Failures

Check the build logs in the Render Dashboard under your service > **Logs**.

### CORS Errors

Ensure `CORS_ORIGIN` in the backend matches your frontend domain exactly (including `https://`).

### Everyone gets "Too many sign-in attempts"

`TRUST_PROXY_HOPS` is unset or `0`. Render routes every request through its own
proxy, so without this the app sees one client address for the whole world and
the per-IP rate limit becomes a global one — a few failed sign-ins from any one
person lock out every user for the rest of the window. Set it to `1` (it
defaults to `1` when `NODE_ENV=production`, so this only bites if something has
overridden it).

Do not set it higher than the number of proxies actually in front of the app,
and never to `true`: each extra hop trusted is one a client can forge in
`X-Forwarded-For` to sidestep the limit.

### Redis Connection Errors

If using a free Render Redis, ensure you're using the **Internal Database URL**, not the External URL.

## Notes

- **Free tier limitations**: Services auto-spin down after 15 minutes of inactivity; first request after spin-down takes ~30s
- **Database backups**: Free Postgres doesn't include automated backups; consider upgrading for production
- **Custom domain**: To use your own domain, configure DNS and SSL in the Render dashboard
- **Monitoring**: Use Render's logs and monitoring tools to track app health

## Next Steps

1. Create an account and log in
2. Log a meal, workout, and sleep to see the dashboard populate
3. Try the plate photo scanning (if Anthropic API key is configured)
4. Explore coaching features by adding a client

---

Need help? Check out:
- [Render Documentation](https://render.com/docs)
- [API Reference](./docs/API.md)
- [Quick Start (local development)](./QUICKSTART.md)
