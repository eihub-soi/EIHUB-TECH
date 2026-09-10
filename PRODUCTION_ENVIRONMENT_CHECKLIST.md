# PRODUCTION ENVIRONMENT CONFIGURATION CHECKLIST

**System:** EI HUB TECH (Innoventry)  
**Security Policy:** Never commit secret values or private API keys to repository source control.

---

## 1. REQUIRED BACKEND ENVIRONMENT VARIABLES

| Variable Name | Belonging Service | Purpose & Description | Required in Production? |
| :--- | :--- | :--- | :---: |
| `CLOUDFLARE_ACCOUNT_ID` | Database | Cloudflare Account ID string for D1 edge database access. | **YES** |
| `CLOUDFLARE_API_TOKEN` | Database | API Token with D1 Edit permissions. | **YES** |
| `CLOUDFLARE_D1_DATABASE_ID`| Database | D1 Database UUID (`wrangler.toml` binding). | **YES** |
| `FIREBASE_CREDENTIALS` | Auth | Base64 or JSON string of Firebase Admin SDK service account key. | **YES** |
| `BREVO_API_KEY` | Email | Brevo (Sendinblue) v3 SMTP API key for sending transactional emails. | **YES** |
| `JWT_SECRET_KEY` | Auth | Cryptographic secret key for signing local session JWT tokens. | **YES** |
| `JWT_ALGORITHM` | Auth | Signature algorithm (Default: `HS256`). | **YES** |
| `ALLOWED_ORIGINS` | Security | Comma-separated list of explicit CORS allowed origins. | **YES** |

---

## 2. OPTIONAL DISTRIBUTED SCALE ENVIRONMENT VARIABLES

| Variable Name | Belonging Service | Purpose & Description | Recommended for Production? |
| :--- | :--- | :--- | :---: |
| `UPSTASH_REDIS_REST_URL` | Distributed Rate Limiter | Upstash Redis REST endpoint URL for multi-instance serverless rate limits. | **HIGHLY RECOMMENDED** |
| `UPSTASH_REDIS_REST_TOKEN` | Distributed Rate Limiter | Upstash Redis REST bearer authorization token. | **HIGHLY RECOMMENDED** |
| `GOOGLE_VISION_API_KEY` | Cloud OCR | Google Cloud Vision API Key for high-accuracy production purchase bill OCR. | **RECOMMENDED** |
| `BREVO_SENDER_EMAIL` | Email | Official sender email address (`eihubsoi@gmail.com` or custom domain). | **RECOMMENDED** |
| `BREVO_SENDER_NAME` | Email | Official sender display name (`EI HUB Support`). | **RECOMMENDED** |

---

## 3. REQUIRED FRONTEND ENVIRONMENT VARIABLES

| Variable Name | Purpose & Description | Public / Private | Required in Production? |
| :--- | :--- | :---: | :---: |
| `VITE_API_BASE_URL` | Base URL of FastAPI backend endpoint (e.g. `https://api.eihub.com`). | Public | **YES** |
| `VITE_FIREBASE_API_KEY` | Firebase Auth Web API key. | Public | **YES** |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Auth domain (`your_project.firebaseapp.com`). | Public | **YES** |
| `VITE_FIREBASE_PROJECT_ID` | Firebase Project ID. | Public | **YES** |
| `VITE_FIREBASE_APP_ID` | Firebase Web App ID. | Public | **YES** |

---

## 4. PRE-DEPLOYMENT VERIFICATION STEPS

- [x] All parameterized database queries verified (Zero SQL injection risks).
- [x] CORS configuration avoids wildcard `*` origins when credentials are included.
- [x] Rate limiting middleware supports Upstash Redis REST fallback for multi-instance Vercel deployments.
- [x] Node.js PDF generation subprocess enforces a 15-second timeout safeguard.
- [x] OCR processing handles missing binaries gracefully with structured manual entry fallback (`manual_entry_required`).
- [x] Frontend production build (`npm run build`) passes cleanly with zero TypeScript errors.
- [x] Backend Python test suite (`unittest`) executes 30 unit & architecture tests with zero failures and zero event loop cleanup warnings.
