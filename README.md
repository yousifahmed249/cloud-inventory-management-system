# Inventory Management System

A production-ready inventory management system built with Node.js, Express, PostgreSQL-ready database support, SQLite fallback, JWT authentication, Docker, and GitHub Actions deployment support.

## Features

- Product management with stock tracking
- Low-stock alerts and inventory value summaries
- Supplier and customer management
- Invoice generation and reporting
- Activity and transaction logs
- JWT-based authentication and protected routes
- PostgreSQL-ready schema with SQLite fallback for local/dev use
- Docker deployment support
- GitHub Actions deployment workflow

## Tech Stack

- Node.js 20+
- Express.js
- SQLite (fallback)
- PostgreSQL-ready via `pg`
- JWT + bcrypt
- Docker
- GitHub Actions

## Project Structure

```text
inventory-management-system/
├── .github/
│   └── workflows/
│       └── deploy.yml
├── db/
│   └── schema.sql
├── scripts/
│   └── init-postgres.js
├── .env
├── .env.example
├── .dockerignore
├── Dockerfile
├── docker-compose.yml
├── DEPLOY.md
├── DEPLOY_AR.md
├── DEPLOY_EN.md
├── package.json
├── server.js
├── index.html
├── style.css
├── script.js
├── data/
│   ├── inventory.db
│   └── inventory.json
└── README.md
```

## Requirements

- Node.js 20+
- npm
- Docker (optional, for containerized deployment)
- PostgreSQL (production deployment)

## Setup

1. Clone the repository
2. Copy `.env.example` to `.env`
3. Configure environment variables
4. Install dependencies:

```bash
npm install
```

## Environment Variables

```env
NODE_ENV=production
PORT=3000
JWT_SECRET=replace-with-long-random-secret
POSTGRES_DB=inventory_db
POSTGRES_USER=inventory_user
POSTGRES_PASSWORD=inventory_pass
DATABASE_URL=postgresql://inventory_user:inventory_pass@localhost:5432/inventory_db
```

## Run locally

```bash
npm start
```

Default admin account:

- Email: admin@inventory.local
- Password: admin123

## PostgreSQL Setup

### With Docker

```bash
docker compose up -d postgres
npm run db:init
npm start
```

### Without Docker

Use an external PostgreSQL service and set `DATABASE_URL` in `.env`.

## Docker Deployment

```bash
docker compose up --build
```

## GitHub Pages and Render Deployment

GitHub Pages hosts the static frontend but cannot run the Express API. Deploy
the API and PostgreSQL database on Render using the included `render.yaml`
Blueprint. Set `FRONTEND_ORIGINS` in the Render service to the GitHub Pages
origin (`https://yousifahmed249.github.io` for this repository), then set
`window.INVENTORY_API_URL` in `config.js` to the deployed Render service URL
without a trailing slash. Commit and push the configuration so Pages can use
the API. See [DEPLOY.md](./DEPLOY.md) for the complete steps.

## Deployment Notes

- PostgreSQL is the production database target
- SQLite is used as a safe fallback when PostgreSQL is not available
- Use a secure secret manager for production credentials
- Keep `.env` files out of source control in real deployments

## License

This project is for educational and business-use prototype development.
