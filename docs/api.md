# API Documentation

Base URL: `/api`

## Authentication

All protected routes require a Bearer token in the `Authorization` header.
`Authorization: Bearer <Firebase_ID_Token>`

## Endpoints

### Auth
- `POST /api/reset-password`: Sends a password reset email via Firebase.

### Components
- `GET /api/components`: Retrieve all components.
- `POST /api/components`: Create a new component (Admin).
- `PUT /api/components/{id}`: Update component details (Admin).
- `DELETE /api/components/{id}`: Delete a component (Admin).

### Requests
- `GET /api/requests`: Fetch user requests.
- `POST /api/requests`: Submit a new component request.
- `POST /api/requests/{id}/approve`: Approve request (Faculty/Admin).
- `POST /api/requests/{id}/reject`: Reject request (Faculty/Admin).
- `POST /api/requests/{id}/return`: Return a borrowed component.

### Profiles
- `GET /api/profiles`: Get all profiles (Admin).
- `GET /api/profiles/{id}`: Get specific profile.
- `POST /api/profiles/sync`: Sync Firebase auth state to database.

### Reports
- `GET /api/reports/pdf`: Generate a PDF report of activity.
- `POST /api/reports/email`: Email a PDF report.
