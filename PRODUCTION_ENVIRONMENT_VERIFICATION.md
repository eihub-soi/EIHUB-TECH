# PRODUCTION ENVIRONMENT VERIFICATION

**Project:** EI HUB TECH (Innoventry)  
**Security Policy:** Variable names documented without exposing real production secret values.

---

## PRODUCTION ENVIRONMENT VARIABLE REGISTRY

| Variable Name | Service | Required? | Configured Status | Purpose & Description |
| :--- | :--- | :---: | :---: | :--- |
| `VITE_API_BASE_URL` | Frontend | **YES** | Configured | Base URL of FastAPI backend endpoint (e.g. `https://api.eihub.com`). |
| `VITE_FIREBASE_API_KEY` | Frontend Auth | **YES** | Configured | Firebase Auth Web API key. |
| `VITE_FIREBASE_AUTH_DOMAIN` | Frontend Auth | **YES** | Configured | Firebase Auth domain (`your_project.firebaseapp.com`). |
| `VITE_FIREBASE_PROJECT_ID` | Frontend Auth | **YES** | Configured | Firebase Project Identifier string. |
| `CLOUDFLARE_ACCOUNT_ID` | Backend DB | **YES** | Configured | Cloudflare Account ID for D1 Database access. |
| `CLOUDFLARE_API_TOKEN` | Backend DB | **YES** | Configured | Bearer token for Cloudflare D1 HTTP REST API queries. |
| `CLOUDFLARE_D1_DATABASE_ID`| Backend DB | **YES** | Configured | Database UUID binding for Cloudflare D1. |
| `FIREBASE_CREDENTIALS` | Backend Auth | **YES** | Configured | Base64 or JSON string of Firebase Admin SDK service account key. |
| `BREVO_API_KEY` | Email API | **YES** | Configured | API key for Brevo transactional email SMTP dispatch. |
| `JWT_SECRET_KEY` | Backend Auth | **YES** | Configured | Cryptographic secret for signing local session JWT tokens. |
| `UPSTASH_REDIS_REST_URL` | Rate Limiter | Recommended | Configured / Optional | Upstash Redis REST URL for multi-instance serverless rate limits. |
| `UPSTASH_REDIS_REST_TOKEN` | Rate Limiter | Recommended | Configured / Optional | Upstash Redis REST token for multi-instance serverless rate limits. |
| `GOOGLE_VISION_API_KEY` | Cloud OCR | Recommended | Optional | Google Cloud Vision API Key for high-accuracy bill OCR. |
| `ALLOWED_ORIGINS` | Security | **YES** | Configured | Explicit CORS allowed origins list (No `*` wildcard in production). |
