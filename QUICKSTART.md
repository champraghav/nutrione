# Quick Start

## 1. Start infrastructure

```bash
docker-compose up -d postgres redis ollama
```

## 2. Configure the backend

```bash
cd backend
cp .env.example .env
npm install
```

## 3. Initialize the database

```bash
npm run migrate
npm run seed
```

## 4. Download an AI model (optional, for the AI coach)

```bash
docker exec health-os-ollama ollama pull mistral
```

## 5. Run the API

```bash
npm run dev
```

The API listens on `http://localhost:3000`. Health check:

```bash
curl http://localhost:3000/health
```

## 6. Try the API

```bash
curl -X POST http://localhost:3000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

Copy the `accessToken` from the response and use it for authenticated requests:

```bash
curl http://localhost:3000/api/v1/users/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## 7. Run the frontend

```bash
cd web
npm install
npm run dev
```

Visit `http://localhost:5173`.

## Everything via Docker

```bash
docker-compose up -d
docker exec health-os-api npm run migrate
docker exec health-os-api npm run seed
```
