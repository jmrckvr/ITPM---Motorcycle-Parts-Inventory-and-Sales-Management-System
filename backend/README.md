# MotoParts Node.js API

This directory contains the Node.js API backed by the MySQL/MariaDB database
running in XAMPP.

## Run locally

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

The API starts at `http://127.0.0.1:8000/api`. It connects to the MySQL database
configured by `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD`.
The database is created automatically if it does not exist. On startup the
backend creates any missing tables and seeds these
accounts:

- `admin@motoparts.test` / `password123`
- `staff@motoparts.test` / `password123`

Stock-in, stock-out, and sales use database transactions. The configured MySQL
database and tables are created automatically on first start.
