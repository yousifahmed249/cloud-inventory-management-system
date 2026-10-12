# Deployment and Run Guide

This project is a complete inventory management system built with Node.js, a PostgreSQL-ready database layer, SQLite fallback, JWT authentication, and Docker support.

## Requirements

- Node.js 20+
- npm
- PostgreSQL database (for production)
- Docker (optional, for containerized deployment)

## Environment variables

Create a `.env` file from `.env.example` and configure the following values:

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

This launches both the PostgreSQL container and the application container.

## PostgreSQL initialization

```bash
npm run db:init
```

This creates the required schema and adds the default admin user.

## GitHub Pages frontend with a Render API

GitHub Pages hosts static files only and cannot run the Express server. Deploy
the API and PostgreSQL database on Render, then connect the Pages frontend:

1. Create a Render Blueprint from this repository. Render uses `render.yaml`
   to create the API service and PostgreSQL database.
2. In the API service environment, set `FRONTEND_ORIGINS` to your GitHub Pages
   site origin (for this repository:
   `https://yousifahmed249.github.io`). Use your custom domain's origin if
   applicable.
3. Once the API is deployed, copy its service URL into `config.js`:

   ```js
   window.INVENTORY_API_URL = "https://your-api-service.onrender.com";
   ```

   Do not add a trailing slash. Commit and push this change so GitHub Pages
   publishes the updated configuration.
4. Verify the API at
   `https://your-api-service.onrender.com/api/health`.

The Render blueprint generates `JWT_SECRET` and connects the API to PostgreSQL.
Make sure the Pages origin and API URL match the actual domains in your deployment.

## Production notes

- Use a managed PostgreSQL service for production.
- Store `JWT_SECRET` in a secure secret manager or environment secret.
- Never commit `.env` files to public repositories.
- Prefer containerized hosting or a managed deployment platform.
