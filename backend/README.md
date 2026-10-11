# MotoParts Node.js API

This directory contains the Node.js replacement for the former Laravel backend.

## Run locally

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

The API starts at `http://127.0.0.1:8000/api`. It connects to MySQL using
`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD`. The database and
tables must be created before startup (for example, `CREATE DATABASE
motoparts;`). On startup the backend creates any missing tables and seeds these
accounts:

- `admin@motoparts.test` / `password123`
- `staff@motoparts.test` / `password123`

Stock-in, stock-out, and sales use InnoDB connection transactions. The legacy
SQLite file in `data/` is not read or modified.

For a local setup:

```powershell
mysql -u root -p -e "CREATE DATABASE motoparts"
Copy-Item .env.example .env
npm run dev
```
