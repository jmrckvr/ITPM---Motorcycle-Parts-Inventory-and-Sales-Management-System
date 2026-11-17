# Motorcycle Parts Inventory and Sales Management System

A 10-week college project for managing motorcycle parts, inventory movements, cashier sales, users, and reports.

## Current phase

Functional completion baseline: the repository contains a Vue 3 + Vite client and a Node.js API backed by MySQL/MariaDB. Authentication, role-based access, inventory movements, POS sales, automatic stock deduction, reports, notifications, and profile/team administration are connected end to end.

See [docs/PHASE-2-ARCHITECTURE.md](docs/PHASE-2-ARCHITECTURE.md) for the architecture, ERD, API plan, roles, and setup commands.

## Run locally

### What you need

- [Node.js](https://nodejs.org/) (LTS)
- [XAMPP](https://www.apachefriends.org/) (only its MySQL is used, so Apache can stay off)

### 1. Start MySQL

Open the **XAMPP Control Panel** and click **Start** next to **MySQL**. It must be running before the backend starts. If the backend fails with `ECONNREFUSED 127.0.0.1:3306`, MySQL is not running.

### 2. Start the backend (first terminal)

```powershell
cd backend
npm install
Copy-Item .env.example .env
npm run dev
```

The API runs at `http://127.0.0.1:8000`. On first start it creates the `BS Tarluck` database, its tables, and two login accounts. The `.env.example` defaults match a standard XAMPP install (user `root`, no password, port 3306). If your MySQL is set up differently, edit `backend/.env`.

### 3. Start the frontend (second terminal)

```powershell
cd frontend
npm install
Copy-Item .env.example .env
npm run dev
```

Open `http://localhost:5173` and sign in with one of these accounts:

| Role  | Email                  | Password      |
| ----- | ---------------------- | ------------- |
| Admin | `admin@motoparts.test` | `password123` |
| Staff | `staff@motoparts.test` | `password123` |

You only need to copy `.env` once. Run `npm install` the first time and again after any pull that changes `package.json`. Otherwise, start MySQL and run `npm run dev` in each folder.

### Optional: demo data

For a presentation-ready database (12 parts with pictures and a week of sample sales), run once from `backend`:

```powershell
npm run seed:demo
```

Run the production checks from the repository root:

```powershell
npm run build
npm test
```

Set a strong `JWT_SECRET` in `backend/.env` before deploying. The backend refuses to start in production without one.
