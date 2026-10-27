# Motorcycle Parts Inventory and Sales Management System

A 10-week college project for managing motorcycle parts, inventory movements, cashier sales, users, and reports.

## Current phase

Phase 2: Design Preparation / Initial Development. The repository contains a Vue 3 + Vite client and a Node.js API backed by SQLite.

See [docs/PHASE-2-ARCHITECTURE.md](docs/PHASE-2-ARCHITECTURE.md) for the architecture, ERD, API plan, roles, and setup commands.

## Run the prototype

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
