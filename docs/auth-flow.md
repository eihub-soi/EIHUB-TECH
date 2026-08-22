# Authentication Flow

## Overview
The platform utilizes **Firebase Authentication** for identity management and JWT token issuance. Role-based access control (RBAC) is enforced on the backend.

## Roles
- `Admin`: Full access to inventory, users, and reports.
- `Faculty`: Can approve/reject student requests.
- `Student`: Can browse inventory and request items.

## Login Flow
1. Client authenticates via Firebase Auth (Email/Password).
2. Firebase returns an ID token (JWT).
3. Client sends ID token in `Authorization: Bearer` header to the FastAPI backend.
4. Backend `get_current_user` middleware:
   - Verifies token signature via Firebase Admin SDK.
   - Extracts UID and Email.
   - Checks the local Database `profiles` table for role claims.
   - Caches the profile in `USER_PROFILE_CACHE` for 60 seconds to reduce DB hits.
5. Client accesses protected routes.

## Signup Flow
- Managed by Administrators. Admins create users in the Database and invite them, or users sign up via Firebase and are assigned a default role (Student).

## Password Reset
- `POST /api/reset-password` triggers `firebase_admin.auth.generate_password_reset_link()`.
- The link is emailed to the user using the Brevo email service.
