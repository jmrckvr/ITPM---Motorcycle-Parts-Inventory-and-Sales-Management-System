# Motorcycle Parts Inventory and Sales Management System

A 10-week college project for managing motorcycle parts, inventory movements, cashier sales, users, and reports.

## Current phase

Functional completion baseline: the repository contains a Vue 3 + Vite client and a Node.js API backed by SQLite. Authentication, role-based access, inventory movements, POS sales, automatic stock deduction, reports, notifications, and profile/team administration are connected end to end.

See [docs/PHASE-2-ARCHITECTURE.md](docs/PHASE-2-ARCHITECTURE.md) for the architecture, ERD, API plan, roles, and setup commands.

## Run locally

```powershell
cd frontend
npm run dev
```

The Node.js API can be started with:

```powershell
cd backend
npm install
Copy-Item .env.example .env
npm run dev
```

The API creates the local SQLite database and seed accounts on first start.

Run the production checks from the repository root:

```powershell
npm run build
npm test
```

Set a strong `JWT_SECRET` in `backend/.env` before deploying. The backend refuses to start in production without one.
