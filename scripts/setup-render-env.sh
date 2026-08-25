#!/bin/bash
# Helper script to generate secure environment variables for Render deployment

set -e

echo "=== Nutrione Render Deployment Setup Helper ==="
echo ""
echo "This script generates secure environment variables for your Render deployment."
echo ""

# Generate random secrets
JWT_ACCESS_SECRET=$(openssl rand -base64 32)
JWT_REFRESH_SECRET=$(openssl rand -base64 32)

echo "Generated Environment Variables:"
echo "================================"
echo ""
echo "Copy these into your Render dashboard > your service > Environment:"
echo ""
echo "NODE_ENV=production"
echo "PORT=3000"
echo "JWT_ACCESS_SECRET=$JWT_ACCESS_SECRET"
echo "JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET"
echo "JWT_ACCESS_EXPIRES_IN=15m"
echo "JWT_REFRESH_EXPIRES_IN=30d"
echo ""
echo "Then add these (you'll fill them in manually):"
echo "DATABASE_URL=<your-postgres-internal-url>"
echo "REDIS_URL=<your-redis-internal-url> (or leave empty for MVP)"
echo "CORS_ORIGIN=https://<your-frontend-domain>.onrender.com"
echo "ANTHROPIC_API_KEY=<optional: your API key from console.anthropic.com>"
echo "VISION_MODEL=claude-sonnet-4-5-20250929"
echo "OLLAMA_URL= (leave empty unless using external Ollama)"
echo "OLLAMA_MODEL= (leave empty unless using external Ollama)"
echo ""
echo "Frontend Environment:"
echo "VITE_API_URL=https://nutrione-api.onrender.com"
echo "VITE_APP_NAME=Health OS"
echo ""
echo "See RENDER_DEPLOY.md for detailed setup instructions."
