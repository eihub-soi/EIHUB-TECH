# EI HUB Enterprise - Full-Stack Architecture

![Architecture](docs/architecture.md)

## Project Overview
EI HUB is an inventory and request management system built for educational and enterprise environments. It allows students to request hardware components and enables faculty/admins to manage inventory, approve requests, and generate activity reports.

## Architecture & Tech Stack
This project follows a clean, decoupled architecture:
- **Frontend**: React, TypeScript, Vite, Tailwind CSS (located in `frontend/`)
- **Backend**: Python, FastAPI, Pydantic (located in `backend/`)
- **Database**: Cloudflare D1 / SQLite
- **Authentication**: Firebase Auth & Firebase Admin SDK
- **Email**: Brevo API

For detailed architectural breakdown, see `docs/architecture.md`.

## Folder Structure
```text
/
├── frontend/         # React SPA
├── backend/          # FastAPI App
│   ├── app/          # Modular API Routes, Services, Models
├── database/         # Schema and migrations
├── docs/             # Technical documentation
├── scripts/          # Developer utilities
└── docker/           # Containerization files
```

## Quick Start (Local Development)

### 1. Environment Setup
Copy `.env.example` to `.env` and fill in your keys (Firebase, Database, Brevo).

### 2. Run Backend
```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate | Mac/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 3. Run Frontend
```bash
cd frontend
npm install
npm run dev
```
Access the app at `http://localhost:5173`.

## Documentation
- [API Documentation](docs/api.md)
- [Authentication Flow](docs/auth-flow.md)
- [Database Schema (ERD)](database/ERD.md)
- [Email System](docs/email-flow.md)
- [Deployment Guide](docs/deployment.md)

## Contributing
Please ensure you follow the existing code style and architecture patterns when adding new features or modifying the REST API layer.
