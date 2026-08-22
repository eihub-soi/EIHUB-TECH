# Codebase Architecture

## Overview
EI HUB is a full-stack enterprise application designed with a React (Vite) frontend and a Python (FastAPI) backend. It follows a modular, monolithic architecture that is scalable and easily maintainable.

## Directory Structure

```text
/project-root
├── frontend/             # React application (Vite)
│   ├── src/
│   │   ├── components/   # Reusable UI elements
│   │   ├── pages/        # Route views
│   │   ├── services/     # API integration layer
│   │   └── ...
│   ├── package.json
│   └── vite.config.ts
│
├── backend/              # FastAPI Application
│   ├── app/
│   │   ├── api/routes/   # REST Endpoints
│   │   ├── schemas/      # Pydantic models for validation
│   │   ├── services/     # Business logic
│   │   ├── database/     # DB Clients (D1, SQLite)
│   │   ├── auth/         # Firebase integration
│   │   └── main.py       # Application entrypoint
│   └── requirements.txt
│
├── database/             # Schema definitions and migrations
├── scripts/              # Utility and one-off Python scripts
├── docs/                 # System documentation
└── docker/               # Container configurations
```

## Technology Stack
- **Frontend**: React 18, TypeScript, Tailwind CSS, Vite
- **Backend**: Python 3.10+, FastAPI, Pydantic
- **Database**: Cloudflare D1 / Turso (SQLite)
- **Authentication**: Firebase Authentication
- **Email**: Brevo (Sendinblue) API
