# MotoParts Node.js API

This directory contains the Node.js replacement for the former Laravel backend.

## Run locally

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

The API starts at `http://127.0.0.1:8000/api`. On first start it creates a fresh SQLite database in `data/motoparts.sqlite` and seeds these accounts:

- `admin@motoparts.test` / `password123`
- `staff@motoparts.test` / `password123`

The database is intentionally generated locally and is ignored by Git.
