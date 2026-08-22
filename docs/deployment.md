# Deployment Guide

## Frontend Deployment (Vercel / Cloudflare Pages)
The Vite frontend is optimized for static hosting.

### Build Steps:
1. `cd frontend`
2. `npm install`
3. `npm run build`
4. The output in `frontend/dist/` can be uploaded to Vercel, Netlify, or Cloudflare Pages.

### Environment Variables (Frontend)
Ensure the following are set in the hosting provider's dashboard:
- `VITE_API_BASE_URL` (Points to your backend URL)
- `VITE_FIREBASE_*` (Firebase web config)

## Backend Deployment (Render / Heroku / VPS)
The FastAPI backend runs via Uvicorn.

### Build Steps:
1. `cd backend`
2. `python -m venv .venv`
3. `source .venv/bin/activate` (Linux/Mac) or `.venv\Scripts\activate` (Windows)
4. `pip install -r requirements.txt`

### Running Production:
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```
Or via Docker using the provided `docker-compose.yml`.

### Environment Variables (Backend)
- `DATABASE_URL` or `CLOUDFLARE_API_TOKEN`
- `FIREBASE_SERVICE_ACCOUNT_JSON_PATH`
- `BREVO_API_KEY`
- `CORS_ORIGINS`

## Database Connection
- If using SQLite locally, ensure `database/` is writable.
- If using Cloudflare D1 in production, configure the D1 bindings/tokens in your environment.
