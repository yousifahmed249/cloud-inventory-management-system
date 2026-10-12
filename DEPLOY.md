# Deployment Guide

This project is a full inventory management app with a Node.js backend, PostgreSQL-ready database layer, SQLite fallback, JWT auth, and Docker support.

## Requirements

- Node.js 20+
- npm
- PostgreSQL database (for production)
- Docker (optional, for local containerized deployment)

## Environment variables

Create a `.env` file from `.env.example` and set the values:

```env
NODE_ENV=production
PORT=3000
JWT_SECRET=replace-with-long-random-secret
POSTGRES_DB=inventory_db
POSTGRES_USER=inventory_user
POSTGRES_PASSWORD=inventory_pass
DATABASE_URL=postgresql://inventory_user:inventory_pass@localhost:5432/inventory_db
```

If PostgreSQL is unavailable, the app automatically falls back to SQLite.

## Local development

```bash
npm install
npm start
```

Default admin account:

- Email: admin@inventory.local
- Password: admin123

## Local PostgreSQL with Docker

```bash
docker compose up -d postgres
npm run db:init
npm start
```

## Full Docker deployment

```bash
docker compose up --build
```

This runs both the PostgreSQL container and the application container together.

## PostgreSQL initialization

```bash
npm run db:init
```

This creates the required schema and inserts the default admin user into PostgreSQL.

## GitHub Pages frontend with a Render API

GitHub Pages only hosts static files; it cannot run the Express API. Deploy the
backend and PostgreSQL database on Render, then point the Pages frontend to it:

1. In Render, create a Blueprint from this repository. Render will use
   `render.yaml` to create the API service and PostgreSQL database.
2. In the API service's environment, set `FRONTEND_ORIGINS` to the origin of
   your GitHub Pages site (for this repository, `https://yousifahmed249.github.io`).
   If you use a custom domain, use that origin instead.
3. After Render deploys the API, copy its service URL into `config.js`:

   ```js
   window.INVENTORY_API_URL = "https://your-api-service.onrender.com";
   ```

   Do not add a trailing slash. Commit and push this change so GitHub Pages
   publishes the updated configuration.
4. Confirm the API is available at
   `https://your-api-service.onrender.com/api/health`.

The Render blueprint generates `JWT_SECRET` and connects the API to PostgreSQL.
The Pages origin and API URL must match the actual domains used by your deployment.

## Production notes

- Use a managed PostgreSQL service for production where possible.
- Keep `JWT_SECRET` in a secure environment secret.
- Do not expose `.env` files in public repositories.
- Prefer containerized deployment or a managed hosting provider.
