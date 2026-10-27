# MotoParts Node.js API

This directory contains the Node.js replacement for the former Laravel backend.

## Run locally

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

The API starts at `http://127.0.0.1:8000/api`. It uses the local SQLite database
at `data/motoparts.sqlite` by default (override it with `DB_FILE`). On startup
the backend creates any missing tables and seeds these
accounts:

- `admin@motoparts.test` / `password123`
- `staff@motoparts.test` / `password123`

Stock-in, stock-out, and sales use database transactions. The SQLite file is
created automatically on first start.
