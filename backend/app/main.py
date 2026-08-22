from fastapi.responses import StreamingResponse
import os
import re
import uuid
import json
import jwt
import requests
import asyncio
import time
import httpx
import base64
from collections import defaultdict
from datetime import datetime, timezone, timedelta, date
from typing import Optional, List, Dict, Any
from fastapi import UploadFile, File
import csv
import io
from fastapi import FastAPI, HTTPException, Security, Depends, Header, Body, Request, Response, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.schemas.models import *
from pydantic import BaseModel
from dotenv import load_dotenv

from contextlib import asynccontextmanager
import firebase_admin
from firebase_admin import credentials, auth as firebase_auth, firestore
from cryptography.x509 import load_pem_x509_certificate

# Cache for parsed Google Public Key objects to avoid RSA decoding overhead on every request
GOOGLE_PUBLIC_KEYS_CACHE: Dict[str, Any] = {}

# Load environment
dotenv_path = os.path.join(os.path.dirname(__file__), "../../.env")
load_dotenv(dotenv_path)

# ----------------------------------------------------
# CONCURRENCY, CACHING AND SCALE STRUCTURES
# ----------------------------------------------------

class TTLMemCache:
    """Coroutine-safe, lock-free in-memory cache with TTL expiration"""
    def __init__(self, ttl: int = 300):
        self.ttl = ttl
        self.cache = {}

    async def get(self, key: str) -> Optional[Any]:
        val, expiry = self.cache.get(key, (None, 0))
        if val is not None and time.time() < expiry:
            return val
        if key in self.cache:
            del self.cache[key]
        return None

    async def set(self, key: str, val: Any):
        # Prevent memory leaks by evicting expired keys on insertion
        now = time.time()
        expired_keys = [k for k, (v, exp) in self.cache.items() if now >= exp]
        for k in expired_keys:
            self.cache.pop(k, None)
            
        # Limit cache capacity to 1000 items
        if len(self.cache) >= 1000:
            # Evict the entry that expires first (i.e. oldest expiry)
            oldest_key = min(self.cache.keys(), key=lambda k: self.cache[k][1])
            self.cache.pop(oldest_key, None)
            
        self.cache[key] = (val, now + self.ttl)

    async def delete(self, key: str):
        if key in self.cache:
            del self.cache[key]

    async def clear(self):
        self.cache.clear()

# User Profile cache for Auth token verification bypass
USER_PROFILE_CACHE = TTLMemCache(ttl=60)

# Caches for catalog and requests lists supporting paginated/filtered caching
COMPONENTS_CACHE = TTLMemCache(ttl=5)
COMPONENTS_CACHE_LOCK = asyncio.Lock()

REQUESTS_CACHE = TTLMemCache(ttl=5)
REQUESTS_CACHE_LOCK = asyncio.Lock()

# Database Admin Caches
TABLES_META_CACHE = TTLMemCache(ttl=300)
SCHEMA_CACHE = TTLMemCache(ttl=300)

# Global locks for thread-safety
db_lock = asyncio.Lock()
google_keys_lock = asyncio.Lock()

# Rate limiting settings
RATE_LIMIT_REQUESTS = defaultdict(list)
RATE_LIMIT_MAX_REQUESTS = 100  # Max requests per window
RATE_LIMIT_WINDOW = 60         # Window size in seconds

# Periodic cleanup task for rate limiting memory leak (run lock-free and coroutine-safe)
async def cleanup_rate_limits():
    while True:
        try:
            await asyncio.sleep(120)  # Prune every 2 minutes
            now = time.time()
            # Copy keys list to avoid ConcurrentModificationError / RuntimeError: dictionary keys changed during iteration
            ips = list(RATE_LIMIT_REQUESTS.keys())
            for ip in ips:
                ts = RATE_LIMIT_REQUESTS.get(ip, [])
                valid_ts = [t for t in ts if now - t < RATE_LIMIT_WINDOW]
                if not valid_ts:
                    RATE_LIMIT_REQUESTS.pop(ip, None)
                else:
                    RATE_LIMIT_REQUESTS[ip] = valid_ts
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"[RateLimit Cleanup] Error: {e}")

# Asynchronous Background Email Queue & Workers
EMAIL_QUEUE = asyncio.Queue()

async def email_worker():
    while True:
        try:
            to_email, subject, html, attachment = await EMAIL_QUEUE.get()
            try:
                await send_brevo_email(to_email, subject, html, attachment)
            except Exception as e:
                print(f"[Email Worker] Failed to send email to {to_email}: {e}")
            finally:
                EMAIL_QUEUE.task_done()
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"[Email Worker] Loop error: {e}")
            await asyncio.sleep(1)



# ----------------------------------------------------
# ENVIRONMENT VARIABLES & VALIDATION
# ----------------------------------------------------
startup_error = None
required_env_vars = [
    "CLOUDFLARE_ACCOUNT_ID",
    "CLOUDFLARE_API_TOKEN",
    "CLOUDFLARE_D1_DATABASE_ID",
]

missing_vars = [var for var in required_env_vars if not os.environ.get(var)]
if missing_vars:
    startup_error = f"Missing required environment variables: {', '.join(missing_vars)}"
    print(f"Startup Warning: {startup_error}")

# Initialize Firebase Admin SDK
firebase_initialized = False
try:
    if not firebase_admin._apps:
        firebase_creds_json = os.environ.get("FIREBASE_CREDENTIALS")
        if firebase_creds_json:
            import json
            cred_dict = json.loads(firebase_creds_json)
            cred = credentials.Certificate(cred_dict)
            firebase_admin.initialize_app(cred)
            firebase_initialized = True
            print("Firebase Admin SDK initialized successfully using FIREBASE_CREDENTIALS env var.")
        else:
            # Fallback to json path if available
            json_path = os.path.join(os.path.dirname(__file__), "..", "ei-hub-9a4a2-firebase-adminsdk-fbsvc-80cd9a3be8.json")
            if os.path.exists(json_path):
                cred = credentials.Certificate(json_path)
                firebase_admin.initialize_app(cred)
                firebase_initialized = True
                print("Firebase Admin SDK initialized successfully using JSON file.")
            else:
                print("Warning: Firebase Admin SDK initialization failed: No JSON file or env vars.")
    else:
        firebase_initialized = True
        print("Firebase Admin SDK already initialized.")
except Exception as e:
    print(f"Warning: Firebase Admin SDK initialization failed: {e}. Programmatic reset link generation will not be active.")

# Connect to Cloudflare D1 Database
CF_ACCOUNT_ID = os.environ.get("CLOUDFLARE_ACCOUNT_ID")
CF_API_TOKEN = os.environ.get("CLOUDFLARE_API_TOKEN")
CF_DB_ID = os.environ.get("CLOUDFLARE_D1_DATABASE_ID")

class Statement:
    def __init__(self, sql: str, args: Optional[list] = None):
        self.sql = sql
        self.args = args or []

class ResultSet:
    def __init__(self, columns: list, rows: list, changes: int = 0):
        self.columns = columns
        self.rows = rows
        self.changes = changes

class D1Client:
    def __init__(self, account_id: str, database_id: str, api_token: str):
        self.account_id = account_id
        self.database_id = database_id
        self.api_token = api_token
        self.url = f"https://api.cloudflare.com/client/v4/accounts/{self.account_id}/d1/database/{self.database_id}/query"
        self.headers = {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json"
        }
        # Connection Pooling: Use a single AsyncClient with connection limits
        limits = httpx.Limits(max_keepalive_connections=20, max_connections=50)
        self.http_client = httpx.AsyncClient(timeout=60.0, limits=limits)

    async def execute(self, sql: str, args: Optional[list] = None):
        results = await self.batch([Statement(sql, args)])
        return results[0]

    async def batch(self, statements: List[Statement]) -> List[ResultSet]:
        all_results = []
        for stmt in statements:
            payload = {"sql": stmt.sql, "params": stmt.args}
            
            resp = await self.http_client.post(self.url, headers=self.headers, json=payload)
            if resp.status_code != 200:
                print("D1 Error:", resp.text)
                raise Exception(f"D1 API error: {resp.status_code} {resp.text}")
                
            data = resp.json()
            if not data.get("success"):
                raise Exception(f"D1 Query failed: {data.get('errors')}")
                
            res = data.get("result", [{}])[0]
            if res.get("success") is False:
                raise Exception(f"D1 Statement failed: {res.get('error')}")
                
            d1_rows = res.get("results", [])
            changes = res.get("meta", {}).get("changes", 0)
            if not d1_rows:
                all_results.append(ResultSet([], [], changes))
            else:
                columns = list(d1_rows[0].keys())
                rows = [list(row.values()) for row in d1_rows]
                all_results.append(ResultSet(columns, rows, changes))
                
        return all_results

    async def close(self):
        await self.http_client.aclose()



import sqlite3

class SQLiteD1Client:
    def __init__(self):
        self.conn = self._get_shared_connection()

    @classmethod
    def _get_shared_connection(cls):
        if not hasattr(cls, '_shared_conn'):
            db_file = "test_database.db"
            cls._shared_conn = sqlite3.connect(db_file, check_same_thread=False)
            cls._shared_conn.row_factory = sqlite3.Row
        return cls._shared_conn

    async def execute(self, sql: str, args: Optional[list] = None):
        results = await self.batch([Statement(sql, args)])
        return results[0]

    async def batch(self, statements: List[Statement]) -> List[ResultSet]:
        all_results = []
        for stmt in statements:
            cursor = self.conn.cursor()
            sql_str = stmt.sql
            args = stmt.args or []
            try:
                cursor.execute(sql_str, args)
                if sql_str.strip().upper().startswith("SELECT"):
                    d1_rows = cursor.fetchall()
                    if not d1_rows:
                        all_results.append(ResultSet([], [], 0))
                    else:
                        columns = list(d1_rows[0].keys())
                        rows = [list(row) for row in d1_rows]
                        all_results.append(ResultSet(columns, rows, 0))
                else:
                    self.conn.commit()
                    all_results.append(ResultSet([], [], cursor.rowcount))
            except Exception as e:
                self.conn.rollback()
                print(f"[SQLite Test Error] SQL: {sql_str} | Error: {e}")
                raise
            finally:
                cursor.close()
        return all_results

    async def close(self):
        pass

# Initialize connection globally as None
client: Optional[Any] = None
db_initialized: bool = False

async def get_db_client() -> Any:
    global client, db_initialized
    import sys
    is_testing = os.environ.get("TESTING") == "True" or "pytest" in sys.modules or "unittest" in sys.modules or (len(sys.argv) > 0 and "pytest" in sys.argv[0])
    
    if startup_error and not is_testing:
        raise HTTPException(status_code=500, detail=f"Database connection failed due to startup error: {startup_error}")
        
    if client is None or not db_initialized:
        async with db_lock:
            if client is None:
                if is_testing:
                    print("Test environment detected. Connecting to isolated local SQLite database.")
                    client = SQLiteD1Client()
                elif CF_ACCOUNT_ID and CF_API_TOKEN and CF_DB_ID:
                    print(f"Connecting to Cloudflare D1: {CF_DB_ID}")
                    client = D1Client(CF_ACCOUNT_ID, CF_DB_ID, CF_API_TOKEN)
                else:
                    print("Warning: Cloudflare D1 credentials missing. Using dummy client.")
                    client = D1Client("mock", "mock", "mock")
                
            if not db_initialized:
                db_initialized = True
    return client

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Pre-initialize client on startup if lifespan runs and no startup error exists
    if not startup_error:
        try:
            await get_db_client()
        except Exception as e:
            print(f"[Lifespan Error] get_db_client failed: {e}")
    
    # Pre-cache PDF banner on startup
    from app.services.pdf_service import get_pdf_banner
    get_pdf_banner()
    
    # Create indexes for optimal date queries and to avoid full table scans
    try:
        await db_execute("CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON profiles(created_at)")
        await db_execute("CREATE INDEX IF NOT EXISTS idx_requests_requested_at ON requests(requested_at)")
        await db_execute("""
            CREATE TABLE IF NOT EXISTS reminder_logs (
                id VARCHAR(255) PRIMARY KEY,
                student_id VARCHAR(255),
                reminder_date VARCHAR(255),
                reminder_type VARCHAR(255)
            )
        """)
        await db_execute("CREATE INDEX IF NOT EXISTS idx_reminder_logs_lookup ON reminder_logs(student_id, reminder_date, reminder_type)")
        print("[Lifespan] D1 database date indexes and reminder_logs table verified/created successfully.")
    except Exception as e:
        print(f"[Lifespan Warning] Could not verify/create D1 indexes/tables: {e}")
    
    # Start background cleanup task
    cleanup_task = asyncio.create_task(cleanup_rate_limits())
    
    # Start background email workers
    email_tasks = [asyncio.create_task(email_worker()) for _ in range(3)]
    
    yield
    
    # Cancel background tasks
    cleanup_task.cancel()
    for task in email_tasks:
        task.cancel()
        
    global client
    if client:
        await client.close()
        client = None

app = FastAPI(title="EI HUB API", description="Python FastAPI Backend for EI HUB", version="1.0.0", lifespan=lifespan)

# Enable Gzip Compression for fast payload transfers
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Enable CORS
allowed_origins_env = os.environ.get("ALLOWED_ORIGINS")
if allowed_origins_env:
    allow_origins = [o.strip() for o in allowed_origins_env.split(",") if o.strip()]
else:
    allow_origins = ["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:3000", "http://127.0.0.1:5173"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup Error Middleware
@app.middleware("http")
async def check_startup_error_middleware(request: Request, call_next):
    import sys
    is_testing = os.environ.get("TESTING") == "True" or "pytest" in sys.modules or "unittest" in sys.modules or (len(sys.argv) > 0 and "pytest" in sys.argv[0])
    if startup_error and not is_testing and request.url.path.startswith("/api") and not request.url.path.endswith("/health"):
        return JSONResponse(
            status_code=500,
            content={"detail": f"Startup Error: {startup_error}"}
        )
    return await call_next(request)

# Security Headers Middleware
@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    response = await call_next(request)
    response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com;"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
    if request.url.path.startswith("/api"):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, private"
    return response

# Per-IP Sliding Window Rate Limiting Middleware
@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    # Exclude API documentation and standard schema endpoints from limit
    if request.url.path in ["/docs", "/redoc", "/openapi.json"]:
        return await call_next(request)
        
    client_ip = request.client.host if request.client else "unknown"
    path = request.url.path
    
    # Classify endpoint limits
    limit = RATE_LIMIT_MAX_REQUESTS
    window = RATE_LIMIT_WINDOW
    if "/auth" in path or "/login" in path:
        limit = 10
    elif "/imports" in path or "/ocr" in path:
        limit = 20
    elif "/admin" in path:
        limit = 30
        
    key = f"{client_ip}:{path.split('/')[2] if len(path.split('/')) > 2 else 'root'}"
    now = time.time()
    
    # Prevent memory leak by bounding dictionary size
    if len(RATE_LIMIT_REQUESTS) > 10000:
        RATE_LIMIT_REQUESTS.clear()
    
    # Keep only request timestamps that fall within the current sliding window
    timestamps = [t for t in RATE_LIMIT_REQUESTS.get(key, []) if now - t < window]
    RATE_LIMIT_REQUESTS[key] = timestamps
    
    if len(timestamps) >= limit:
        return Response(
            content=json.dumps({"detail": "Too many requests. Please try again later."}),
            status_code=429,
            media_type="application/json",
            headers={"Retry-After": str(window)}
        )
        
    RATE_LIMIT_REQUESTS[key].append(now)
    return await call_next(request)

# Strict email validation middleware rejecting any email value with uppercase letters
@app.middleware("http")
async def strict_email_validation_middleware(request: Request, call_next):
    if request.url.path in ["/docs", "/redoc", "/openapi.json"]:
        return await call_next(request)

    # 1. Check query parameters
    for k, v in request.query_params.items():
        if "email" in k.lower() and v:
            if any(c.isupper() for c in v):
                return Response(
                    content=json.dumps({"error": "Email address must contain only lowercase letters."}),
                    status_code=400,
                    media_type="application/json"
                )

    # 2. Check JSON request body
    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        body_bytes = await request.body()
        if body_bytes:
            try:
                body_json = json.loads(body_bytes)
                def has_uppercase_email(data):
                    if isinstance(data, dict):
                        for key, val in data.items():
                            if "email" in key.lower() and isinstance(val, str) and val:
                                if any(c.isupper() for c in val):
                                    return True
                            elif isinstance(val, (dict, list)):
                                if has_uppercase_email(val):
                                    return True
                    elif isinstance(data, list):
                        for item in data:
                            if has_uppercase_email(item):
                                return True
                    return False

                if has_uppercase_email(body_json):
                    return Response(
                        content=json.dumps({"error": "Email address must contain only lowercase letters."}),
                        status_code=400,
                        media_type="application/json"
                    )
            except Exception:
                pass
            
            # Recreate receive channel so body can be read again
            async def receive():
                return {"type": "http.request", "body": body_bytes, "more_body": False}
            request._receive = receive

    return await call_next(request)

# Structured request logger middleware
@app.middleware("http")
async def logging_middleware(request: Request, call_next):
    # Exclude static assets or documentation endpoints from verbose logging
    if request.url.path in ["/docs", "/redoc", "/openapi.json"]:
        return await call_next(request)
        
    start_time = time.time()
    try:
        response = await call_next(request)
        duration = time.time() - start_time
        print(f"[API Request] {request.method} {request.url.path} - Status: {response.status_code} - Duration: {duration:.4f}s")
        return response
    except Exception as e:
        duration = time.time() - start_time
        print(f"[API Exception] {request.method} {request.url.path} - Failed after {duration:.4f}s - Error: {e}")
        raise

# Centralized exception handlers for production hardening
class LowercaseEmailException(Exception):
    pass

@app.exception_handler(LowercaseEmailException)
async def lowercase_email_exception_handler(request: Request, exc: LowercaseEmailException):
    return Response(
        content=json.dumps({"error": "Email address must contain only lowercase letters."}),
        status_code=400,
        media_type="application/json"
    )

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return Response(
        content=json.dumps({"detail": exc.detail}),
        status_code=exc.status_code,
        media_type="application/json"
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    # Log complete exception details
    print(f"[Unhandled Error] {request.method} {request.url.path} - Details: {exc}")
    import traceback
    traceback.print_exc()
    return Response(
        content=json.dumps({"detail": "An internal server error occurred. Please try again later."}),
        status_code=500,
        media_type="application/json"
    )

# Helper to run raw SQL queries with automatic retry capabilities
def row_to_dict(columns, row):
    import math
    def sanitize(v):
        if isinstance(v, float) and math.isnan(v):
            return None
        return v
    return {col: sanitize(val) for col, val in zip(columns, row)}

async def db_query(sql: str, params: Optional[list] = None) -> List[Dict[str, Any]]:
    max_retries = 3
    delay = 0.2
    for attempt in range(max_retries):
        try:
            db_client = await get_db_client()
            result = await db_client.execute(sql, params or [])
            cols = result.columns
            return [row_to_dict(cols, row) for row in result.rows]
        except Exception as e:
            if attempt == max_retries - 1:
                print(f"[DB Query Failure] Query: {sql} | Error: {e}")
                raise
            print(f"[DB Query Retry] Attempt {attempt + 1} failed for: {sql}. Retrying in {delay}s...")
            await asyncio.sleep(delay)
            delay *= 2
    return []

async def db_execute(sql: str, params: Optional[list] = None):
    max_retries = 3
    delay = 0.2
    for attempt in range(max_retries):
        try:
            db_client = await get_db_client()
            return await db_client.execute(sql, params or [])
        except Exception as e:
            if attempt == max_retries - 1:
                print(f"[DB Execute Failure] SQL: {sql} | Error: {e}")
                raise
            print(f"[DB Execute Retry] Attempt {attempt + 1} failed for: {sql}. Retrying in {delay}s...")
            await asyncio.sleep(delay)
            delay *= 2

async def db_batch(statements: List[Any]) -> Any:
    max_retries = 3
    delay = 0.2
    for attempt in range(max_retries):
        try:
            db_client = await get_db_client()
            return await db_client.batch(statements)
        except Exception as e:
            if attempt == max_retries - 1:
                print(f"[DB Batch Failure] Error: {e}")
                raise
            print(f"[DB Batch Retry] Attempt {attempt + 1} failed. Retrying in {delay}s...")
            await asyncio.sleep(delay)
            delay *= 2
async def get_all_request_codes() -> Dict[str, str]:
    rows = await db_query("SELECT id, requested_at FROM requests ORDER BY requested_at ASC, id ASC")
    mapping = {}
    for i, row in enumerate(rows):
        req_id = row["id"]
        if req_id.startswith("req-"):
            try:
                val = int(req_id[4:])
                mapping[req_id] = f"REQ-{val}"
            except Exception:
                mapping[req_id] = f"REQ-{i+1}"
        else:
            mapping[req_id] = f"REQ-{i+1}"
    return mapping

async def get_single_request_code(req_id: str, requested_at: Optional[str] = None) -> str:
    if req_id.startswith("req-"):
        try:
            val = int(req_id[4:])
            return f"REQ-{val}"
        except Exception:
            pass
    if not requested_at:
        res_req = await db_query("SELECT requested_at FROM requests WHERE id = ?", [req_id])
        if res_req and res_req[0].get("requested_at"):
            requested_at = res_req[0]["requested_at"]
        else:
            return f"REQ-{req_id[:8].upper()}"
    res = await db_query(
        "SELECT COUNT(*) as count FROM requests WHERE requested_at < ? OR (requested_at = ? AND id <= ?)",
        [requested_at, requested_at, req_id]
    )
    count = res[0]["count"] if res else 1
    return f"REQ-{count}"

# Token validation helper
security = HTTPBearer()
GOOGLE_KEYS = {}

async def get_google_public_key(kid: str) -> str:
    global GOOGLE_KEYS
    # Fast path if key is already cached
    if kid in GOOGLE_KEYS:
        return GOOGLE_KEYS[kid]
        
    async with google_keys_lock:
        # Double check cache inside lock
        if kid in GOOGLE_KEYS:
            return GOOGLE_KEYS[kid]
            
        url = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"
        try:
            async with httpx.AsyncClient(timeout=10.0) as http_client:
                r = await http_client.get(url)
                if r.status_code == 200:
                    GOOGLE_KEYS = r.json()
                    print("[Google Certs] Refreshed and cached Google public keys.")
        except Exception as e:
            print(f"Error fetching Google certs: {e}")
            
    cert_pem = GOOGLE_KEYS.get(kid)
    if not cert_pem:
        raise HTTPException(status_code=401, detail="Invalid token kid")
    return cert_pem

DEMO_PROFILES = {
    "usr-student-1": {
        "uid": "usr-student-1",
        "email": "student-01@kgkite.ac.in",
        "name": "Aravind R",
        "role": "student"
    },
    "usr-faculty-1": {
        "uid": "usr-faculty-1",
        "email": "faculty-01@kgkite.ac.in",
        "name": "Prof. Robert Chen",
        "role": "faculty"
    },
    "usr-admin-1": {
        "uid": "usr-admin-1",
        "email": "admin-02@kgkite.ac.in",
        "name": "Admin User",
        "role": "admin"
    }
}

async def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> Dict[str, Any]:
    if not credentials:
        raise HTTPException(status_code=401, detail="Authorization header required")
    
    token = credentials.credentials
    env = os.environ.get("ENV", "production").lower()
    is_production = env == "production"
    
    # Check user profile cache first
    cached_user = await USER_PROFILE_CACHE.get(token)
    if cached_user:
        email_val = cached_user.get("email")
        if email_val:
            if any(c.isupper() for c in email_val):
                raise HTTPException(status_code=401, detail="invalid emailid/password")
            if is_production and not email_val.strip().lower().endswith("@kgkite.ac.in"):
                raise HTTPException(status_code=403, detail="Only official @kgkite.ac.in accounts are permitted.")
        return cached_user
        
    # Helper to cache and return
    async def cache_and_return(user_dict):
        email_val = user_dict.get("email")
        if email_val:
            if any(c.isupper() for c in email_val):
                raise HTTPException(status_code=401, detail="invalid emailid/password")
            if is_production and not email_val.strip().lower().endswith("@kgkite.ac.in"):
                raise HTTPException(status_code=403, detail="Only official @kgkite.ac.in accounts are permitted.")
        await USER_PROFILE_CACHE.set(token, user_dict)
        return user_dict

    if is_production:
        # Strict Firebase JWT validation only in production.
        # Do not allow demo/mock profiles or raw user ID fallback.
        if token in DEMO_PROFILES or token.startswith("demo-") or (not isinstance(token, str) or token.count('.') != 2):
            raise HTTPException(status_code=401, detail="Authentication token bypass is disabled in production.")

    # Check for demo/mock auth tokens
    if not is_production:
        if token in DEMO_PROFILES:
            return await cache_and_return(DEMO_PROFILES[token])
            
        if token.startswith("demo-"):
            role = token.replace("demo-", "")
            for dp in DEMO_PROFILES.values():
                if dp["role"] == role:
                    return await cache_and_return(dp)
            res_dict = {"uid": token, "email": f"{role}@kgkite.ac.in", "name": f"Demo {role.capitalize()}", "role": role}
            return await cache_and_return(res_dict)

        # If the token does not look like a JWT (doesn't have two dots), try fallback DB query directly first
        if not isinstance(token, str) or token.count('.') != 2:
            try:
                profiles = await db_query("SELECT id, email, full_name, role FROM profiles WHERE id = ?", [token])
                if profiles:
                    p = profiles[0]
                    res_dict = {
                        "uid": p["id"],
                        "email": p["email"],
                        "name": p["full_name"],
                        "role": p["role"]
                    }
                    return await cache_and_return(res_dict)
            except Exception:
                pass

    # Verify standard Firebase JWT using Admin SDK
    try:
        decoded = firebase_auth.verify_id_token(token, check_revoked=True, clock_skew_seconds=60)
        uid = decoded.get("uid")
        email = decoded.get("email")
        name = decoded.get("name", "User")
        
        if email:
            email_lower = email.strip().lower()
            if any(c.isupper() for c in email):
                raise HTTPException(status_code=400, detail="invalid emailid/password")
            if is_production and not email_lower.endswith("@kgkite.ac.in"):
                raise HTTPException(status_code=403, detail="Only official @kgkite.ac.in accounts are permitted.")
        
        # Pull profile details from database if possible
        try:
            profile = await db_query("SELECT id, email, full_name, role FROM profiles WHERE id = ? OR firebase_uid = ?", [uid, uid])
            if profile:
                res_dict = {
                    "uid": profile[0]["id"],
                    "email": profile[0]["email"],
                    "name": profile[0]["full_name"],
                    "role": profile[0]["role"]
                }
                return await cache_and_return(res_dict)
            else:
                # Create profile if missing
                default_role = "student"
                
                # Assume DB has created_at column natively or we just insert required fields
                await db_execute(
                    "INSERT INTO profiles (id, firebase_uid, email, full_name, role) VALUES (?, ?, ?, ?, ?)",
                    [uid, uid, email, name, default_role]
                )
                
                res_dict = {
                    "uid": uid,
                    "email": email,
                    "name": name,
                    "role": default_role
                }
                return await cache_and_return(res_dict)
        except Exception as db_e:
            print(f"Error querying/inserting profile: {db_e}")
            res_dict = {
                "uid": uid,
                "email": email,
                "name": name,
                "role": "student"
            }
            return await cache_and_return(res_dict)
            
    except HTTPException:
        raise
    except Exception as e:
        # Fallback check inside profiles table for direct IDs
        try:
            profiles = await db_query("SELECT id, email, full_name, role FROM profiles WHERE id = ?", [token])
            if profiles:
                p = profiles[0]
                res_dict = {
                    "uid": p["id"],
                    "email": p["email"],
                    "name": p["full_name"],
                    "role": p["role"]
                }
                return await cache_and_return(res_dict)
        except Exception:
            pass
        raise HTTPException(status_code=401, detail=f"Auth error: {str(e)}")

async def require_admin(user: dict = Depends(get_current_user)) -> Dict[str, Any]:
    if user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin privileges required")
    return user

async def require_faculty_or_admin(user: dict = Depends(get_current_user)) -> Dict[str, Any]:
    if user.get("role") not in ["faculty", "admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Faculty or Admin privileges required")
    return user

# Row cleanup helper
def clean_row(table_name: str, row: dict) -> dict:
    if not row:
        return row
    cleaned = dict(row)
    if table_name == "profiles":
        if "is_active" in cleaned and cleaned["is_active"] is not None:
            cleaned["is_active"] = bool(cleaned["is_active"])
        if "email_verified" in cleaned and cleaned["email_verified"] is not None:
            cleaned["email_verified"] = bool(cleaned["email_verified"])


    return cleaned

from app.services.email_service import send_brevo_email, send_brevo_email_advanced

# In-memory capped list to prevent memory leak under high volumes
class CappedList(list):
    def __init__(self, max_size: int = 5000):
        super().__init__()
        self.max_size = max_size

    def append(self, item):
        super().append(item)
        if len(self) > self.max_size:
            # Keep latest 2500 items to avoid constant slicing and memory reallocation overhead
            self[:] = self[-2500:]

# Audit log helper
in_memory_activity_logs = CappedList(max_size=5000)

async def log_activity(user_id: str, user_name: str, action: str, entity_type: str, entity_id: str, details: dict, status: str = "success"):
    log_id = str(uuid.uuid4())
    created_at_iso = datetime.now(timezone.utc).replace(tzinfo=None).isoformat() + "Z"
    in_memory_activity_logs.append({
        "id": log_id,
        "user_id": user_id,
        "user_name": user_name,
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "details": json.dumps(details),
        "status": status,
        "created_at": created_at_iso
    })
    return log_id

# In-memory notifications storage
in_memory_notifications = CappedList(max_size=5000)

# Notification helper
async def add_notification(user_id: str, title: str, message: str, type_str: str = "info", link_url: Optional[str] = None):
    notif_id = str(uuid.uuid4())
    created_at_iso = datetime.now(timezone.utc).replace(tzinfo=None).isoformat() + "Z"
    in_memory_notifications.append({
        "id": notif_id,
        "user_id": user_id,
        "title": title,
        "message": message,
        "type": type_str,
        "is_read": False,
        "link_url": link_url,
        "created_at": created_at_iso
    })

def validate_lowercase_email(email: str) -> str:
    if not email:
        return ""
    if any(c.isupper() for c in email):
        return "Email address must contain only lowercase letters."
    if not re.match(r"^[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,}$", email):
        return "Please enter a valid email address format."
    return ""


@app.post("/api/auth/reset-link")
async def get_firebase_reset_link(req: ResetLinkRequest):
    try:
        # Check if Firebase Admin is initialized
        if not firebase_admin._apps:
            raise HTTPException(status_code=500, detail="Firebase Admin SDK is not initialized. Please configure the service account.")

        email_error = validate_lowercase_email(req.email.strip())
        if email_error:
            return JSONResponse(status_code=400, content={"error": email_error})
            
        # Verify the user exists in profiles database first
        profiles = await db_query("SELECT email FROM profiles WHERE email = ?", [req.email.strip()])
        if not profiles:
            raise HTTPException(status_code=404, detail="This email is not registered in our database.")
        
        # Generate the password reset link
        frontend_url = os.environ.get("FRONTEND_URL") or os.environ.get("VITE_APP_URL", "http://localhost:3000")
        if frontend_url.endswith("/"):
            frontend_url = frontend_url[:-1]
        redirect_url = f"{frontend_url}/reset-password"
        
        action_code_settings = firebase_auth.ActionCodeSettings(
            url=redirect_url,
            handle_code_in_app=True
        )
        
        link = await asyncio.to_thread(
            firebase_auth.generate_password_reset_link,
            req.email.strip(),
            action_code_settings
        )
        
        # Enqueue the email to be sent by worker
        html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
        <h2 style="color: #4f46e5; text-align: center; margin-top: 0; font-size: 22px;">EI HUB Password Reset</h2>
        <p style="color: #334155; font-size: 14px; line-height: 1.6; text-align: center;">You requested a password reset for your EI HUB account. Click the button below to set a new password.</p>
        <div style="text-align: center; margin: 30px 0;">
        <a href="{link}" style="background-color: #4f46e5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">Reset Password</a>
        </div>
        <p style="color: #64748b; font-size: 11px; text-align: center; margin-bottom: 0; border-top: 1px solid #f1f5f9; padding-top: 20px;">If you did not request this, you can safely ignore this email.</p>
        </div>
        """
        await EMAIL_QUEUE.put((req.email.strip(), "EI HUB - Password Reset", html, None))
        
        return {"status": "success", "message": "Password reset email queued"}
    except Exception as e:
        print(f"Error generating password reset link: {e}")
        if isinstance(e, HTTPException):
            raise e
        return JSONResponse(status_code=400, content={"error": str(e)})

# Global fetches tracking dictionary for request coalescing
ACTIVE_FETCHES = {}

# 1. Components
@app.post("/api/auth/otp")
async def send_otp(data: dict = Body(...)):
    email = data.get("email")
    code = data.get("code")
    if not email or not code:
        raise HTTPException(status_code=400, detail="Email and code required")
        
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
    <h2 style="color: #4f46e5; text-align: center; margin-top: 0; font-size: 22px;">EI HUB Verification</h2>
    <p style="color: #334155; font-size: 14px; line-height: 1.6; text-align: center;">Welcome to EI HUB! Use the following 6-digit one-time password (OTP) to complete your student self-registration. This OTP is valid for 10 minutes.</p>
    <div style="text-align: center; margin: 30px 0;">
    <span style="font-size: 36px; font-weight: 800; letter-spacing: 6px; color: #1e1b4b; background-color: #f1f5f9; padding: 12px 24px; border-radius: 12px; display: inline-block; border: 1px solid #e2e8f0;">{code}</span>
    </div>
    <p style="color: #64748b; font-size: 11px; text-align: center; margin-bottom: 0; border-top: 1px solid #f1f5f9; padding-top: 20px;">If you did not request this verification, you can safely ignore this email.</p>
    </div>
    """
    # Enqueue the email to be sent by worker
    await EMAIL_QUEUE.put((email, "EI HUB - Student Verification OTP Code", html, None))
    return {"status": "success", "message": "OTP queued for sending"}

@app.get("/api/health")
async def health_check():
    return {
        "status": "error" if startup_error else "ok",
        "startup_error": startup_error,
        "firebase_configured": firebase_initialized,
        "database_connected": client is not None and db_initialized
    }

@app.get("/api/components")
async def get_components(page: Optional[int] = None, limit: Optional[int] = None):
    cache_key = f"components_list_{page}_{limit}"
    
    # 1. Lock-free cache check
    cached = await COMPONENTS_CACHE.get(cache_key)
    if cached is not None:
        return cached
        
    # 2. Request coalescing: collapse duplicate concurrent fetches into a single task
    if cache_key in ACTIVE_FETCHES:
        return await ACTIVE_FETCHES[cache_key]
        
    async def fetch_task():
        if page is None or limit is None:
            rows = await db_query("SELECT * FROM components ORDER BY created_at DESC")
        else:
            offset = (page - 1) * limit
            rows = await db_query("SELECT * FROM components ORDER BY created_at DESC LIMIT ? OFFSET ?", [limit, offset])
            
        cleaned_rows = []
        for r in rows:
            c = dict(r)
            # Add frontend-specific virtual fields
            c["borrowed_stock"] = c["total_stock"] - c["available_stock"]
            c["sku"] = f"COMP-{c['id'][:4].upper()}"
            c["cabinet"] = c["location"].split(",")[0].strip() if c["location"] and "," in c["location"] else c["location"] or "Lab A"
            c["shelf"] = c["location"].split(",")[1].strip() if c["location"] and "," in c["location"] else "Shelf 1"
            c["unit_cost"] = 0
            cleaned_rows.append(c)
            
        await COMPONENTS_CACHE.set(cache_key, cleaned_rows)
        return cleaned_rows

    task = asyncio.create_task(fetch_task())
    ACTIVE_FETCHES[cache_key] = task
    try:
        return await task
    finally:
        ACTIVE_FETCHES.pop(cache_key, None)

@app.post("/api/components")
async def create_component(data: dict = Body(...), user: dict = Depends(require_admin)):
    name = data.get("name")
    if not name:
        raise HTTPException(status_code=400, detail="Component name is required")
        
    # Prevent duplicate component name
    existing = await db_query("SELECT id FROM components WHERE LOWER(name) = ? LIMIT 1", [name.lower().strip()])
    if existing:
        raise HTTPException(status_code=400, detail="A component with this name already exists.")

    comp_id = str(uuid.uuid4())
    category = data.get("category")
    description = data.get("description", "")
    total_stock = int(data.get("total_stock", 0))
    available_stock = int(data.get("available_stock", total_stock))
    location = data.get("location", "Lab A, Shelf 1")
    image_url = data.get("image_url", "")
    unit = data.get("unit", "pcs")
    
    # Batch inserting component and logging activity into a single RTT
    db_client = await get_db_client()
    
    stmt1 = Statement(
        """
        INSERT INTO components (id, name, category, description, total_stock, available_stock, location, image_url, unit, created_at, updated_at)
        SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now')
        WHERE NOT EXISTS (
            SELECT 1 FROM components WHERE LOWER(name) = ?
        )
        RETURNING id
        """,
        [comp_id, name, category, description, total_stock, available_stock, location, image_url, unit, name.lower().strip()]
    )
    
    res = await db_batch([stmt1])
    
    # Check if rows were affected (meaning it was inserted)
    if not res or not res[0] or not res[0].rows:
        raise HTTPException(status_code=400, detail="A component with this name already exists or could not be created.")
    
    await COMPONENTS_CACHE.clear()
    return {"id": comp_id, "name": name, "category": category, "total_stock": total_stock, "available_stock": available_stock}

@app.put("/api/components/{id}")
async def update_component(id: str, data: dict = Body(...), user: dict = Depends(require_admin)):
    name = data.get("name")
    category = data.get("category")
    description = data.get("description", "")
    total_stock = int(data.get("total_stock", 0))
    available_stock = int(data.get("available_stock", total_stock))
    location = data.get("location", "Lab A, Shelf 1")
    image_url = data.get("image_url", "")
    
    db_client = await get_db_client()
    
    stmt1 = Statement(
        """
        UPDATE components
        SET name = ?, category = ?, description = ?, total_stock = ?, available_stock = ?, location = ?, image_url = ?, updated_at = datetime('now')
        WHERE id = ?
        """,
        [name, category, description, total_stock, available_stock, location, image_url, id]
    )
    
    stmt2 = Statement("SELECT 1")

    
    
    await db_batch([stmt1, stmt2])
    
    await COMPONENTS_CACHE.clear()
    return {"id": id, "name": name, "category": category}

@app.delete("/api/components/{id}")
async def delete_component(id: str, user: dict = Depends(require_admin)):
    # Fetch component details first
    comps = await db_query("SELECT name FROM components WHERE id = ?", [id])
    if not comps:
        raise HTTPException(status_code=404, detail="Component not found")
    name = comps[0]["name"]
    
    # Check if there are active loans or pending requests for this component
    active_requests = await db_query("SELECT id FROM requests WHERE component_id = ? AND status IN ('pending', 'approved')", [id])
    if active_requests:
        raise HTTPException(status_code=400, detail="Cannot delete component: Component is referenced by active or pending borrow requests.")
        
    db_client = await get_db_client()
    
    stmt1 = Statement("DELETE FROM components WHERE id = ?", [id])
    
    stmt2 = Statement("SELECT 1")

    await db_batch([stmt1, stmt2])
    
    await COMPONENTS_CACHE.clear()
    return {"id": id, "status": "deleted"}


# 2. Borrow Requests
@app.get("/api/requests")
async def get_requests(page: Optional[int] = None, limit: Optional[int] = None, user: dict = Depends(get_current_user)):
    user_id = user["uid"]
    role = user.get("role", "student")
    
    cache_key = f"requests_list_{page}_{limit}_{user_id}_{role}"
    
    # 1. Lock-free cache check
    cached = await REQUESTS_CACHE.get(cache_key)
    if cached is not None:
        return cached
        
    # 2. Request coalescing
    if cache_key in ACTIVE_FETCHES:
        return await ACTIVE_FETCHES[cache_key]
        
    async def fetch_task():
        params = [user_id] if role == "student" else []
        
        if page is None or limit is None:
            if role == "student":
                sql = """
                    SELECT r.*, 
                           s.full_name as student_name, s.register_number as student_register_no, s.email as student_email,
                           s.department as student_department, s.year_of_study as student_year, s.phone as student_phone, s.roll_number as student_roll_no,
                           s.institution as student_institution,
                           a.full_name as approver_name,
                           ar.full_name as return_reviewed_by_name,
                           c.name as component_name, c.category as component_category, c.image_url as component_image
                    FROM requests r
                    LEFT JOIN profiles s ON r.student_id = s.id
                    LEFT JOIN profiles a ON r.reviewed_by = a.id
                    LEFT JOIN profiles ar ON r.return_reviewed_by = ar.id
                    LEFT JOIN components c ON r.component_id = c.id
                    WHERE r.student_id = ?
                    ORDER BY r.requested_at DESC
                """
            else:
                sql = """
                    SELECT r.*, 
                           s.full_name as student_name, s.register_number as student_register_no, s.email as student_email,
                           s.department as student_department, s.year_of_study as student_year, s.phone as student_phone, s.roll_number as student_roll_no,
                           s.institution as student_institution,
                           a.full_name as approver_name,
                           ar.full_name as return_reviewed_by_name,
                           c.name as component_name, c.category as component_category, c.image_url as component_image
                    FROM requests r
                    LEFT JOIN profiles s ON r.student_id = s.id
                    LEFT JOIN profiles a ON r.reviewed_by = a.id
                    LEFT JOIN profiles ar ON r.return_reviewed_by = ar.id
                    LEFT JOIN components c ON r.component_id = c.id
                    ORDER BY r.requested_at DESC
                """
            rows = await db_query(sql, params)
        else:
            offset = (page - 1) * limit
            if role == "student":
                sql = """
                    SELECT r.*, 
                           s.full_name as student_name, s.register_number as student_register_no, s.email as student_email,
                           s.department as student_department, s.year_of_study as student_year, s.phone as student_phone, s.roll_number as student_roll_no,
                           s.institution as student_institution,
                           a.full_name as approver_name,
                           ar.full_name as return_reviewed_by_name,
                           c.name as component_name, c.category as component_category, c.image_url as component_image
                    FROM requests r
                    LEFT JOIN profiles s ON r.student_id = s.id
                    LEFT JOIN profiles a ON r.reviewed_by = a.id
                    LEFT JOIN profiles ar ON r.return_reviewed_by = ar.id
                    LEFT JOIN components c ON r.component_id = c.id
                    WHERE r.student_id = ?
                    ORDER BY r.requested_at DESC
                    LIMIT ? OFFSET ?
                """
                query_params = params + [limit, offset]
            else:
                sql = """
                    SELECT r.*, 
                           s.full_name as student_name, s.register_number as student_register_no, s.email as student_email,
                           s.department as student_department, s.year_of_study as student_year, s.phone as student_phone, s.roll_number as student_roll_no,
                           s.institution as student_institution,
                           a.full_name as approver_name,
                           ar.full_name as return_reviewed_by_name,
                           c.name as component_name, c.category as component_category, c.image_url as component_image
                    FROM requests r
                    LEFT JOIN profiles s ON r.student_id = s.id
                    LEFT JOIN profiles a ON r.reviewed_by = a.id
                    LEFT JOIN profiles ar ON r.return_reviewed_by = ar.id
                    LEFT JOIN components c ON r.component_id = c.id
                    ORDER BY r.requested_at DESC
                    LIMIT ? OFFSET ?
                """
                query_params = [limit, offset]
            rows = await db_query(sql, query_params)
            
        cleaned_rows = []
        mapping = await get_all_request_codes()
        for r in rows:
            req = dict(r)
            
            # Reconstruct custom fields formatted in reject_reason string for returned conditions
            reject_reason = req.get("reject_reason") or ""
            parsed_condition = "Good / Fully Functional"
            parsed_description = ""
            parsed_missing = ""
            parsed_damaged = ""
            parsed_remarks = ""
            
            if reject_reason.startswith("Condition reported by student:"):
                parts = reject_reason.split(" | ")
                for part in parts:
                    if part.startswith("Condition reported by student:"):
                        parsed_condition = part.replace("Condition reported by student:", "").strip()
                    elif part.startswith("Description:"):
                        parsed_description = part.replace("Description:", "").strip()
                    elif part.startswith("Missing:"):
                        parsed_missing = part.replace("Missing:", "").strip()
                    elif part.startswith("Damaged:"):
                        parsed_damaged = part.replace("Damaged:", "").strip()
                    elif part.startswith("Remarks:"):
                        parsed_remarks = part.replace("Remarks:", "").strip()

            # Add virtual fields for frontend compatibility
            req["request_code"] = mapping.get(req["id"], f"REQ-{req['id'][:8].upper()}")
            req["approved_by"] = req["reviewed_by"]
            req["approved_by_name"] = req["approver_name"] or "Prof. Robert Chen"
            req["rejection_reason"] = req["reject_reason"] or ""
            req["approved_at"] = req["reviewed_at"]
            # Calculate expected_return_at dynamically
            notes_str = req.get("notes") or ""
            to_date_val = None
            to_time_val = "17:00"
            if "To Date:" in notes_str:
                for line in notes_str.split("\n"):
                    if line.startswith("To Date:"):
                        to_date_val = line.replace("To Date:", "").strip()
                        break
            if "To Time:" in notes_str:
                for line in notes_str.split("\n"):
                    if line.startswith("To Time:"):
                        to_time_val = line.replace("To Time:", "").strip()
                        break
            
            expected_return_at = None
            ist_tz = timezone(timedelta(hours=5, minutes=30))
            if to_date_val:
                try:
                    y, m, d = map(int, to_date_val.split("-"))
                    hour, minute = 17, 0
                    time_str = to_time_val.upper()
                    is_pm = "PM" in time_str
                    is_am = "AM" in time_str
                    clean_time = time_str.replace("AM", "").replace("PM", "").strip()
                    time_parts = clean_time.split(":")
                    if len(time_parts) >= 2:
                        h = int(time_parts[0])
                        min_val = int(time_parts[1])
                        if is_pm and h < 12:
                            h += 12
                        elif is_am and h == 12:
                            h = 0
                        hour, minute = h, min_val
                    
                    expected_return_at = datetime(y, m, d, hour, minute, tzinfo=ist_tz).isoformat()
                except Exception:
                    expected_return_at = f"{to_date_val}T17:00:00+05:30"
            
            if not expected_return_at:
                try:
                    req_at_str = req.get("requested_at")
                    clean_req_at = req_at_str.replace("Z", "") if req_at_str else datetime.now(timezone.utc).replace(tzinfo=None).isoformat()
                    req_dt = datetime.fromisoformat(clean_req_at).replace(tzinfo=timezone.utc)
                    req_dt_ist = req_dt.astimezone(ist_tz)
                    due_dt_ist = (req_dt_ist + timedelta(days=14)).replace(hour=17, minute=0, second=0, microsecond=0)
                    expected_return_at = due_dt_ist.isoformat()
                except Exception:
                    expected_return_at = req.get("requested_at")
            
            req["expected_return_at"] = expected_return_at
            req["return_condition"] = parsed_condition
            req["return_description"] = parsed_description
            req["return_missing_details"] = parsed_missing
            req["return_damaged_details"] = parsed_damaged
            req["return_remarks"] = parsed_remarks
            req["created_at"] = req["requested_at"]
            req["purpose"] = req.get("notes") or ""
            cleaned_rows.append(req)
            
        await REQUESTS_CACHE.set(cache_key, cleaned_rows)
        return cleaned_rows

    task = asyncio.create_task(fetch_task())
    ACTIVE_FETCHES[cache_key] = task
    try:
        return await task
    finally:
        ACTIVE_FETCHES.pop(cache_key, None)


@app.get("/api/requests/verify/{requestCode}")
async def verify_receipt_public(requestCode: str):
    lookup_code = requestCode
    is_short_code = False
    if requestCode.lower().startswith("req-"):
        lookup_code = requestCode[4:]
        is_short_code = True
        
    uuid_pattern = re.compile(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")
    is_uuid = bool(uuid_pattern.match(lookup_code))

    is_numeric_seq = False
    seq_index = -1
    if is_short_code and len(lookup_code) != 8:
        try:
            seq_index = int(lookup_code) - 1
            is_numeric_seq = True
        except ValueError:
            pass

    if is_numeric_seq and seq_index >= 0:
        seq_res = await db_query("SELECT id FROM requests ORDER BY requested_at ASC, id ASC LIMIT 1 OFFSET ?", [seq_index])
        if seq_res:
            lookup_code = seq_res[0]["id"]
            is_uuid = True
            is_short_code = False
        else:
            raise HTTPException(status_code=404, detail="Transaction receipt not found in official registry.")
    elif is_short_code and not is_uuid:
        # Check if it matches direct string (like test request ids e.g. req-1)
        direct_res = await db_query("SELECT id FROM requests WHERE LOWER(id) = ?", [lookup_code.lower()])
        if direct_res:
            lookup_code = direct_res[0]["id"]
            is_uuid = True
            is_short_code = False

    sql = """
        SELECT r.id, r.student_id, r.component_id, r.quantity, r.status, r.notes, r.reject_reason, r.requested_at, r.reviewed_at, r.reviewed_by, r.returned_at,
               s.full_name as student_full_name, s.register_number as student_register_number, s.email as student_email, s.department as student_department,
               c.name as component_name, c.category as component_category, c.image_url as component_image_url,
               appr.full_name as approver_full_name
        FROM requests r
        LEFT JOIN profiles s ON r.student_id = s.id
        LEFT JOIN components c ON r.component_id = c.id
        LEFT JOIN profiles appr ON r.reviewed_by = appr.id
    """
    
    if is_short_code and len(lookup_code) == 8:
        sql += " WHERE LOWER(r.id) LIKE ?"
        params = [f"{lookup_code.lower()}%"]
    elif is_uuid or (is_short_code and len(lookup_code) != 8):
        sql += " WHERE r.id = ?"
        params = [lookup_code]
    else:
        raise HTTPException(status_code=400, detail="Invalid request code format.")

    rows = await db_query(sql, params)
    if not rows:
        raise HTTPException(status_code=404, detail="Transaction receipt not found in official registry.")

    row = rows[0]
    mapping = await get_all_request_codes()
    return {
        "id": row["id"],
        "request_code": mapping.get(row["id"], f"REQ-{row['id'][:8].upper()}"),
        "student_id": row["student_id"],
        "student_name": row.get("student_full_name") or "N/A",
        "student_register_no": row.get("student_register_number") or "N/A",
        "student_email": row.get("student_email") or "N/A",
        "student_department": row.get("student_department") or "ECE",
        "component_id": row["component_id"],
        "component_name": row.get("component_name") or "N/A",
        "component_category": row.get("component_category") or "Others",
        "component_image": row.get("component_image_url"),
        "quantity": row["quantity"],
        "purpose": row.get("notes") or "Lab Experimentation",
        "status": row["status"],
        "approved_by": row["reviewed_by"],
        "approved_by_name": row.get("approver_full_name") or "Prof. Robert Chen",
        "rejection_reason": row.get("reject_reason") or "",
        "requested_at": row["requested_at"],
        "approved_at": row.get("reviewed_at") or row["requested_at"],
        "expected_return_at": row["requested_at"],
        "returned_at": row.get("returned_at"),
        "created_at": row["requested_at"]
    }

@app.post("/api/requests/submit")
async def submit_request(data: dict = Body(...), user: dict = Depends(get_current_user)):
    req_id = str(uuid.uuid4())
    student_id = data.get("student_id")
    component_id = data.get("component_id")
    if not isinstance(student_id, str) or not isinstance(component_id, str):
        raise HTTPException(status_code=400, detail="student_id and component_id must be strings")
        
    if student_id != user["uid"] and user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="You can only submit requests for yourself.")
    
    quantity = int(data.get("quantity", 1))
    if quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be greater than zero")
    purpose = data.get("notes", "Lab Experimentation")
    
    # Check component existence and stock (informational, real check is atomic)
    comp_res = await db_query("SELECT name, available_stock FROM components WHERE id = ?", [component_id])
    if not comp_res:
        raise HTTPException(status_code=404, detail="Component not found")
    comp_name = comp_res[0]["name"]
    available_stock = comp_res[0]["available_stock"]
    
    if available_stock < quantity:
        raise HTTPException(status_code=400, detail=f"Cannot submit request: insufficient stock (only {available_stock} available)")

    req_at = datetime.now(timezone.utc).replace(tzinfo=None).isoformat() + "Z"
    count_res = await db_query("SELECT COUNT(*) as count FROM requests")
    count_val = count_res[0]["count"] if count_res else 0
    req_code = f"REQ-{count_val + 1}"
    
    # Atomic Insert with NOT EXISTS to prevent duplicates
    insert_res = await db_query('''
        INSERT INTO requests (id, student_id, component_id, quantity, status, notes, requested_at)
        SELECT ?, ?, ?, ?, 'pending', ?, ?
        WHERE NOT EXISTS (
            SELECT 1 FROM requests WHERE student_id = ? AND component_id = ? AND status = 'pending'
        )
        RETURNING id
    ''', [req_id, student_id, component_id, quantity, purpose, req_at, student_id, component_id])
    
    if not insert_res:
        raise HTTPException(status_code=400, detail="You already have a pending request for this component.")
    
    # We successfully uniquely inserted!
    
    # Notifications and Emails
    faculty_res = await db_query("SELECT id, role FROM profiles WHERE role IN ('faculty', 'admin')")
    student_res = await db_query("SELECT email FROM profiles WHERE id = ?", [student_id])
    
    created_at_iso = datetime.now(timezone.utc).replace(tzinfo=None).isoformat() + "Z"
    in_memory_notifications.append({"id": str(uuid.uuid4()), "user_id": student_id, "title": "Request Received", "message": f"Your request for {quantity}x {comp_name} has been submitted for faculty approval.", "type": "info", "is_read": False, "link_url": "/student/requests", "created_at": created_at_iso})
    
    if faculty_res:
        for r in faculty_res:
            link = "/admin/pending-requests" if r["role"] == "admin" else "/faculty/pending-requests"
            in_memory_notifications.append({"id": str(uuid.uuid4()), "user_id": r["id"], "title": "New Borrow Request", "message": f"Student {user['name']} has requested {quantity}x {comp_name} ({req_code}).", "type": "info", "is_read": False, "link_url": link, "created_at": created_at_iso})
    
    # Email notifications disabled as per notification flow refinements
    await REQUESTS_CACHE.clear()
    return {"id": req_id, "status": "pending"}

@app.post("/api/requests/{id}/approve")
async def approve_request(id: str, data: dict = Body(...), user: dict = Depends(require_faculty_or_admin)):
    faculty_id = user["uid"]
    remark = data.get("notes", "")
    pdf_base64 = data.get("pdf_base64")
    
    reqs = await db_query('''
        SELECT r.*, c.name as component_name, c.available_stock, s.email as student_email, s.full_name as student_name
        FROM requests r
        JOIN components c ON r.component_id = c.id
        JOIN profiles s ON r.student_id = s.id
        WHERE r.id = ?
    ''', [id])
    if not reqs:
        raise HTTPException(status_code=404, detail="Request not found")
        
    req = reqs[0]
    if req["status"] != "pending":
        raise HTTPException(status_code=400, detail="Only pending requests can be approved")
        
    if req["available_stock"] < req["quantity"]:
        raise HTTPException(status_code=400, detail="Cannot approve: stock depleted")
        
    app_at = datetime.now(timezone.utc).replace(tzinfo=None).isoformat() + "Z"
    req_code = await get_single_request_code(id, req.get("requested_at"))
    
    stmt1 = Statement(
        '''
        UPDATE requests 
        SET status = 'approved', reviewed_by = ?, reviewed_at = ?, reject_reason = ?
        WHERE id = ? AND status = 'pending' AND (
            SELECT available_stock FROM components WHERE id = requests.component_id
        ) >= quantity
        ''',
        [faculty_id, app_at, remark, id]
    )
    
    stmt2 = Statement(
        '''
        UPDATE components 
        SET id = CASE WHEN available_stock - ? >= 0 THEN id ELSE NULL END,
            available_stock = available_stock - ?, 
            updated_at = datetime('now') 
        WHERE id = ? AND EXISTS (
            SELECT 1 FROM requests WHERE id = ? AND status = 'approved' AND reviewed_at = ?
        )
        ''',
        [req["quantity"], req["quantity"], req["component_id"], id, app_at]
    )
    
    await log_activity(user["uid"], user["name"], "APPROVE_REQUEST", "REQUEST", id, {"code": req_code, "component": req["component_name"], "remark": remark}, "success")
    try:
        results = await db_batch([stmt1, stmt2])
        if not results or results[0].changes == 0:
            raise HTTPException(status_code=400, detail="Cannot approve: stock depleted or request already processed")
    except HTTPException:
        raise
    except Exception as e:
        if "constraint" in str(e).lower() or "not null" in str(e).lower():
            raise HTTPException(status_code=400, detail="Cannot approve: stock depleted or insufficient stock")
        raise
    
    await add_notification(req["student_id"], "Request Approved", f"Your request for {req['quantity']}x {req['component_name']} has been approved.", "success", "/student/requests")
    
    # Email notifications disabled as per notification flow refinements
    await REQUESTS_CACHE.clear()
    await COMPONENTS_CACHE.clear()
    return {"id": id, "status": "approved"}

@app.post("/api/requests/{id}/reject")
async def reject_request(id: str, data: dict = Body(...), user: dict = Depends(require_faculty_or_admin)):
    faculty_id = user["uid"]
    reason = data.get("reason", "")
    
    reqs = await db_query('''
        SELECT r.*, c.name as component_name, s.email as student_email, s.full_name as student_name
        FROM requests r
        JOIN components c ON r.component_id = c.id
        JOIN profiles s ON r.student_id = s.id
        WHERE r.id = ?
    ''', [id])
    
    if not reqs:
        raise HTTPException(status_code=404, detail="Request not found")
        
    req = reqs[0]
    app_at = datetime.now(timezone.utc).replace(tzinfo=None).isoformat() + "Z"
    req_code = await get_single_request_code(id, req.get("requested_at"))
    
    stmt1 = Statement(
        '''
        UPDATE requests 
        SET status = 'rejected', reviewed_by = ?, reviewed_at = ?, reject_reason = ?
        WHERE id = ? AND status = 'pending'
        ''',
        [faculty_id, app_at, reason, id]
    )
    
    await log_activity(user["uid"], user["name"], "REJECT_REQUEST", "REQUEST", id, {"code": req_code, "component": req["component_name"], "reason": reason}, "warning")
    await db_batch([stmt1])
    
    await add_notification(req["student_id"], "Request Rejected", f"Your request for {req['quantity']}x {req['component_name']} was rejected.", "warning", "/student/requests")
    await REQUESTS_CACHE.clear()
    return {"id": id, "status": "rejected"}

@app.post("/api/requests/{id}/return-request")
async def return_request(id: str, data: dict = Body(...), user: dict = Depends(get_current_user)):
    notes = data.get("notes", "")
    reqs = await db_query('''
        SELECT r.quantity, r.status, r.student_id, c.name FROM requests r 
        JOIN components c ON r.component_id = c.id 
        WHERE r.id = ?
    ''', [id])
    if not reqs:
        raise HTTPException(status_code=404, detail="Request not found")
        
    req = reqs[0]
    if user.get("role") not in ["admin", "super_admin", "faculty"] and req["student_id"] != user["uid"]:
        raise HTTPException(status_code=403, detail="Forbidden: You are not authorized to return this request")
        
    app_at = datetime.now(timezone.utc).replace(tzinfo=None).isoformat() + "Z"
    
    stmt1 = Statement(
        '''
        UPDATE requests
        SET return_requested_at = ?, reject_reason = ?
        WHERE id = ? AND status != 'returned'
        ''',
        [app_at, notes, id]
    )
    
    await log_activity(user["uid"], user["name"], "RETURN_REQUESTED", "REQUEST", id, {"component": req["name"]}, "info")
    await db_batch([stmt1])
    await REQUESTS_CACHE.clear()
    return {"id": id, "status": "return-requested"}

@app.post("/api/requests/{id}/return-process")
async def return_process_request(id: str, data: dict = Body(...), user: dict = Depends(require_faculty_or_admin)):
    faculty_id = user["uid"]
    notes = data.get("notes", "")
    
    reqs = await db_query('''
        SELECT r.*, c.name as component_name, c.total_stock, c.available_stock, s.email as student_email, s.full_name as student_name
        FROM requests r
        JOIN components c ON r.component_id = c.id
        JOIN profiles s ON r.student_id = s.id
        WHERE r.id = ?
    ''', [id])
    
    if not reqs:
        raise HTTPException(status_code=404, detail="Request not found")
        
    req = reqs[0]
    app_at = datetime.now(timezone.utc).replace(tzinfo=None).isoformat() + "Z"
    
    stmt1 = Statement(
        '''
        UPDATE requests
        SET status = 'returned', returned_at = ?, return_reviewed_by = ?, reject_reason = ?
        WHERE id = ? AND status != 'returned'
        ''',
        [app_at, faculty_id, notes, id]
    )
    
    stmt2 = Statement(
        '''
        UPDATE components
        SET available_stock = MIN(total_stock, available_stock + ?), updated_at = datetime('now')
        WHERE id = ? AND EXISTS (
            SELECT 1 FROM requests WHERE id = ? AND status = 'returned' AND returned_at = ?
        )
        ''',
        [req["quantity"], req["component_id"], id, app_at]
    )
    
    await log_activity(user["uid"], user["name"], "RETURN_PROCESSED", "REQUEST", id, {"component": req["component_name"]}, "success")
    results = await db_batch([stmt1, stmt2])
    if not results or results[0].changes == 0:
        raise HTTPException(status_code=400, detail="Return already processed or invalid request status")
    
    await add_notification(req["student_id"], "Return Processed", f"Your return for {req['component_name']} has been processed.", "success", "/student/requests")
    
    await REQUESTS_CACHE.clear()
    await COMPONENTS_CACHE.clear()
    return {"id": id, "status": "returned"}

@app.get("/api/profiles")
async def get_current_user_profile(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    endpoint = "/api/profiles"
    request_id = str(uuid.uuid4())
    user_id = current_user.get("uid")
    email = current_user.get("email")
    start_time = time.time()
    
    print(f"[API Request] RequestID: {request_id} | Endpoint: {endpoint} | User: {user_id} ({email}) | DB Op: SELECT")
    
    try:
        rows = await db_query("SELECT * FROM profiles WHERE id = ? OR firebase_uid = ?", [user_id, user_id])
        execution_time = time.time() - start_time
        
        if not rows:
            print(f"[API Warning] RequestID: {request_id} | Endpoint: {endpoint} | Category: PROFILE_NOT_FOUND | User: {user_id} | Time: {execution_time:.4f}s")
            raise HTTPException(status_code=404, detail="Profile not found in inventory system")
            
        print(f"[API Success] RequestID: {request_id} | Endpoint: {endpoint} | User: {user_id} | Time: {execution_time:.4f}s")
        return clean_row("profiles", rows[0])
        
    except HTTPException:
        raise
    except Exception as e:
        execution_time = time.time() - start_time
        print(f"[API Exception] RequestID: {request_id} | Endpoint: {endpoint} | Category: DATABASE_ERROR | User: {user_id} | Error: {str(e)} | Time: {execution_time:.4f}s")
        raise HTTPException(status_code=500, detail="Internal server error while fetching profile")

@app.post("/api/profiles/sync")
async def sync_profile(data: dict = Body(...), user: dict = Depends(get_current_user)):
    return {"status": "success", "message": "Profiles sync is deprecated in favor of Firebase directly, or just handled here"}

@app.get("/api/profiles/{id}")
async def get_profile_by_id(id: str, current_user: dict = Depends(get_current_user)):
    # Security constraint: students can only fetch their own profile. Admin/Faculty can fetch any.
    if current_user.get("role") not in ["admin", "super_admin", "faculty"] and current_user.get("uid") != id:
        raise HTTPException(status_code=403, detail="Forbidden: You are not authorized to view this profile")
        
    rows = await db_query('SELECT * FROM profiles WHERE id = ? OR firebase_uid = ?', [id, id])
    if not rows:
        raise HTTPException(404, "Profile not found")
    return clean_row("profiles", rows[0])

@app.put("/api/profiles/{id}")
async def update_profile(
    id: str,
    data: dict = Body(...),
    current_user: dict = Depends(get_current_user)
):
    # 1. Access Control / Authorization Checks
    is_admin = current_user.get("role") in ["admin", "super_admin"]
    if not is_admin and current_user.get("uid") != id:
        raise HTTPException(status_code=403, detail="Forbidden: You are not authorized to update this profile")
        
    # 2. Check profile existence in SQLite/D1 database
    existing_rows = await db_query("SELECT * FROM profiles WHERE id = ? OR firebase_uid = ?", [id, id])
    if not existing_rows:
        raise HTTPException(status_code=404, detail="Profile not found")
        
    existing_profile = existing_rows[0]
    user_actual_id = existing_profile["id"]
    
    # 3. Pull incoming fields, and map mobile_number fallback to phone
    email = data.get("email")
    full_name = data.get("full_name")
    role = data.get("role")
    department = data.get("department")
    phone = data.get("phone") or data.get("mobile_number")
    register_number = data.get("register_number")
    roll_number = data.get("roll_number")
    institution = data.get("institution")
    year_of_study = data.get("year_of_study")
    faculty_id = data.get("faculty_id")
    is_active = data.get("is_active")
    username = data.get("username")
    
    # 4. Strict Security Checks for Non-Admins (IDOR and Privilege Escalation prevention)
    if not is_admin:
        if role and role != existing_profile.get("role"):
            raise HTTPException(status_code=403, detail="Forbidden: Non-admins cannot change user roles")
        if is_active is not None:
            existing_active = existing_profile.get("is_active")
            is_active_int = 1 if is_active else 0
            if is_active_int != existing_active:
                raise HTTPException(status_code=403, detail="Forbidden: Non-admins cannot change account active status")
        if email and email != existing_profile.get("email"):
            raise HTTPException(status_code=403, detail="Forbidden: Non-admins cannot change email address")
        if username and username != existing_profile.get("username"):
            raise HTTPException(status_code=403, detail="Forbidden: Non-admins cannot change username")
            
    # Use existing roles if not supplied
    if not role:
        role = existing_profile.get("role")
        
    if is_active is not None:
        if isinstance(is_active, bool):
            is_active = 1 if is_active else 0
        else:
            try:
                is_active = int(is_active)
            except ValueError:
                is_active = existing_profile.get("is_active")
    else:
        is_active = existing_profile.get("is_active")

    # 5. Email & Username validation rules (only domain @kgkite.ac.in and lowercase format)
    old_email = existing_profile.get("email")
    old_username = existing_profile.get("username")
    firebase_uid = existing_profile.get("firebase_uid")

    if email:
        email = email.strip()
        email_err = validate_lowercase_email(email)
        if email_err:
            raise HTTPException(status_code=400, detail=email_err)
        if not email.endswith("@kgkite.ac.in"):
            raise HTTPException(status_code=400, detail="Only official @kgkite.ac.in email addresses are allowed.")
            
        # Check duplicate email only if it is different from the current user's email (case-insensitive check)
        is_same_email = False
        if old_email and email.lower() == old_email.strip().lower():
            is_same_email = True

        if not is_same_email:
            dup_email = await db_query("SELECT id FROM profiles WHERE LOWER(email) = LOWER(?) AND id != ?", [email, user_actual_id])
            if dup_email:
                raise HTTPException(status_code=409, detail="Email address is already in use by another user.")
            
    if username:
        username = username.strip()
        # Check duplicate username only if it is different from the current user's username (case-insensitive check)
        is_same_username = False
        if old_username and username.lower() == old_username.strip().lower():
            is_same_username = True

        if not is_same_username:
            dup_username = await db_query("SELECT id FROM profiles WHERE LOWER(username) = LOWER(?) AND id != ?", [username, user_actual_id])
            if dup_username:
                raise HTTPException(status_code=409, detail="Username is already in use by another user.")

    # 6. Synchronize email and full name with Firebase Auth if Firebase is configured
    if email and old_email and email.lower() != old_email.strip().lower():
        if firebase_admin._apps:
            try:
                target_auth_uid = firebase_uid or user_actual_id
                firebase_auth.update_user(target_auth_uid, email=email, display_name=full_name or existing_profile.get("full_name"))
                print(f"[Firebase Sync] Successfully updated Firebase email for {target_auth_uid} from {old_email} to {email}")
            except Exception as fe:
                fe_msg = str(fe)
                if "email already exists" in fe_msg.lower() or "email_already_exists" in fe_msg.lower():
                    raise HTTPException(status_code=409, detail="Email is already in use by another authentication account.")
                print(f"[Firebase Sync Warning] Firebase update failed/skipped: {fe_msg}")

    # 7. Persist changes in the database using parameterized queries in transaction
    try:
        await db_execute(
            """
            UPDATE profiles
            SET email = ?, full_name = ?, role = ?, department = ?, phone = ?, 
                register_number = ?, roll_number = ?, institution = ?, year_of_study = ?, 
                faculty_id = ?, is_active = ?, username = ?, updated_at = datetime('now')
            WHERE id = ?
            """,
            [
                email or existing_profile.get("email"),
                full_name or existing_profile.get("full_name"),
                role,
                department,
                phone,
                register_number,
                roll_number,
                institution,
                year_of_study,
                faculty_id,
                is_active,
                username or existing_profile.get("username"),
                user_actual_id
            ]
        )
    except Exception as dbe:
        print(f"[DB Update Error] Failed to update profile record: {dbe}")
        raise HTTPException(status_code=500, detail=f"Database update failed: {str(dbe)}")

    # 8. Clear the backend user profile cache
    await USER_PROFILE_CACHE.clear()

    # 9. Return the updated user record
    updated_rows = await db_query("SELECT * FROM profiles WHERE id = ?", [user_actual_id])
    if not updated_rows:
        raise HTTPException(status_code=500, detail="Failed to retrieve updated profile from database")
        
    updated_profile = clean_row("profiles", updated_rows[0])
    
    return {
        "success": True,
        "message": "User updated successfully",
        "user": {
            "user_id": updated_profile.get("id"),
            "full_name": updated_profile.get("full_name"),
            "username": updated_profile.get("username"),
            "email": updated_profile.get("email"),
            "mobile_number": updated_profile.get("phone"),
            "phone": updated_profile.get("phone"),
            "role": updated_profile.get("role"),
            "department": updated_profile.get("department"),
            "institution": updated_profile.get("institution"),
            "register_number": updated_profile.get("register_number"),
            "roll_number": updated_profile.get("roll_number"),
            "year_of_study": updated_profile.get("year_of_study"),
            "faculty_id": updated_profile.get("faculty_id"),
            "is_active": bool(updated_profile.get("is_active"))
        }
    }

@app.delete("/api/profiles/{id}")
async def delete_profile(
    id: str,
    current_user: dict = Depends(get_current_user)
):
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Forbidden: You are not authorized to delete profiles")
        
    if current_user.get("uid") == id or current_user.get("id") == id:
        raise HTTPException(status_code=400, detail="You cannot delete your own profile.")
        
    # Check if there are active loans
    loans = await db_query("SELECT id FROM requests WHERE student_id = ? AND status = 'approved'", [id])
    if loans:
        raise HTTPException(status_code=400, detail="Cannot delete profile: User has active borrowed components.")
        
    await db_execute(
        "DELETE FROM profiles WHERE id = ? OR firebase_uid = ?",
        [id, id]
    )
    return {"status": "success", "message": "Profile deleted successfully"}

@app.post("/api/activity-logs")
async def create_activity_log(log: ActivityLogCreate):
    log_id = await log_activity(log.user_id, log.user_name, log.action, log.entity_type, log.entity_id, log.details, log.status)
    return {"id": log_id, "status": "success"}

@app.get("/api/activity-logs")
async def get_activity_logs():
    return list(reversed(in_memory_activity_logs))

@app.get("/api/notifications")
async def get_notifications(user: dict = Depends(get_current_user)):
    return [n for n in reversed(in_memory_notifications) if n["user_id"] == user["uid"]]

@app.post("/api/notifications/{id}/read")
async def read_notification(id: str, user: dict = Depends(get_current_user)):
    for n in in_memory_notifications:
        if n["id"] == id and n["user_id"] == user["uid"]:
            n["is_read"] = True
    return {"status": "success"}

@app.post("/api/notifications/read-all")
async def read_all_notifications(user: dict = Depends(get_current_user)):
    for n in in_memory_notifications:
        if n["user_id"] == user["uid"]:
            n["is_read"] = True
    return {"status": "success"}

@app.get("/api/purchase-orders")
async def get_purchase_orders(user: dict = Depends(require_admin)):
    rows = await db_query('SELECT * FROM purchase_orders ORDER BY created_at DESC')
    return rows

@app.post("/api/purchase-orders")
async def create_purchase_order(data: dict = Body(...), user: dict = Depends(require_admin)):
    po_id = str(uuid.uuid4())
    po_number = data.get("po_number")
    supplier_name = data.get("supplier_name")
    component_id = data.get("component_id")
    component_name = data.get("component_name")
    component_category = data.get("component_category", "Electronics")
    quantity = int(data.get("quantity", 1))
    if quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be greater than zero")
    unit_cost = float(data.get("unit_cost", 0.0))
    if unit_cost < 0:
        raise HTTPException(status_code=400, detail="Unit cost cannot be negative")
    total_cost = quantity * unit_cost
    invoice_ref = data.get("invoice_ref", "")
    cabinet = data.get("cabinet", "")
    shelf = data.get("shelf", "")
    
    stmt1 = Statement(
        '''
        INSERT INTO purchase_orders (id, po_number, supplier_name, component_id, component_name, component_category, quantity, unit_cost, total_cost, purchased_by, purchased_by_name, invoice_ref, cabinet, shelf, status, purchased_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'delivered', datetime('now'), datetime('now'))
        ''',
        [po_id, po_number, supplier_name, component_id, component_name, component_category, quantity, unit_cost, total_cost, user["uid"], user["name"], invoice_ref, cabinet, shelf]
    )
    
    stmt2 = Statement(
        '''
        UPDATE components 
        SET total_stock = total_stock + ?, available_stock = available_stock + ?, updated_at = datetime('now')
        WHERE id = ?
        ''',
        [quantity, quantity, component_id]
    )
    
    await log_activity(user["uid"], user["name"], "PURCHASE_STOCK", "COMPONENT", po_id, {"po_number": po_number, "component": component_name, "qty": quantity}, "success")
    
    await db_batch([stmt1, stmt2])
    
    await COMPONENTS_CACHE.clear()
    return {"id": po_id, "po_number": po_number}

@app.put("/api/purchase-orders/{po_id}")
async def update_purchase_order(po_id: str, data: dict = Body(...), user: dict = Depends(require_admin)):
    # 1. Fetch existing PO
    pos = await db_query("SELECT * FROM purchase_orders WHERE id = ?", [po_id])
    if not pos:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    po = pos[0]
    
    supplier_name = data.get("supplier_name", po["supplier_name"])
    raw_qty = data.get("quantity")
    new_quantity = int(raw_qty) if raw_qty is not None else int(po["quantity"])
    if new_quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be greater than zero")
    raw_cost = data.get("unit_cost")
    unit_cost = float(raw_cost) if raw_cost is not None else float(po["unit_cost"])
    if unit_cost < 0:
        raise HTTPException(status_code=400, detail="Unit cost cannot be negative")
    total_cost = new_quantity * unit_cost
    invoice_ref = data.get("invoice_ref", po["invoice_ref"])
    cabinet = data.get("cabinet", po["cabinet"])
    shelf = data.get("shelf", po["shelf"])
    component_id = po["component_id"]
    quantity_diff = new_quantity - po["quantity"]
    
    stmts = []
    # Update PO statement
    stmt1 = Statement(
        """
        UPDATE purchase_orders
        SET supplier_name = ?, quantity = ?, unit_cost = ?, total_cost = ?, invoice_ref = ?, cabinet = ?, shelf = ?, updated_at = datetime('now')
        WHERE id = ?
        """,
        [supplier_name, new_quantity, unit_cost, total_cost, invoice_ref, cabinet, shelf, po_id]
    )
    stmts.append(stmt1)
    
    if component_id:
        comps = await db_query("SELECT id, total_stock, available_stock FROM components WHERE id = ?", [component_id])
        if comps:
            comp = comps[0]
            new_tot = max(0, comp["total_stock"] + quantity_diff)
            new_avail = max(0, comp["available_stock"] + quantity_diff)
            stmt2 = Statement(
                """
                UPDATE components
                SET total_stock = ?, available_stock = ?, updated_at = datetime('now')
                WHERE id = ?
                """,
                [new_tot, new_avail, component_id]
            )
            stmts.append(stmt2)
            
    await db_batch(stmts)
    await COMPONENTS_CACHE.clear()
    return {"status": "success"}

@app.delete("/api/purchase-orders/{po_id}")
async def delete_purchase_order(po_id: str, user: dict = Depends(require_admin)):
    pos = await db_query("SELECT * FROM purchase_orders WHERE id = ?", [po_id])
    if not pos:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    po = pos[0]
    
    component_id = po["component_id"]
    quantity = po["quantity"]
    
    stmts = []
    stmt1 = Statement(
        "DELETE FROM purchase_orders WHERE id = ?",
        [po_id]
    )
    stmts.append(stmt1)
    
    if component_id:
        comps = await db_query("SELECT id, total_stock, available_stock FROM components WHERE id = ?", [component_id])
        if comps:
            comp = comps[0]
            new_tot = max(0, comp["total_stock"] - quantity)
            new_avail = max(0, comp["available_stock"] - quantity)
            stmt2 = Statement(
                """
                UPDATE components
                SET total_stock = ?, available_stock = ?, updated_at = datetime('now')
                WHERE id = ?
                """,
                [new_tot, new_avail, component_id]
            )
            stmts.append(stmt2)
            
    await db_batch(stmts)
    await COMPONENTS_CACHE.clear()
    return {"status": "success"}


# 7. Consolidated Deadline Alert Cron Endpoint
@app.post("/api/cron/check-reminders")
async def check_reminders(authorization: Optional[str] = Header(None)):
    cron_secret = os.environ.get("CRON_SECRET")
    if cron_secret:
        if not authorization or authorization != f"Bearer {cron_secret}":
            raise HTTPException(status_code=401, detail="Unauthorized cron trigger")
    # Fetch all approved and unreturned borrow requests with component details
    active_loans = await db_query("""
        SELECT r.*, c.name as component_name, c.sku as component_sku, s.email as student_email, s.full_name as student_name
        FROM requests r
        JOIN components c ON r.component_id = c.id
        JOIN profiles s ON r.student_id = s.id
        WHERE r.status = 'approved' AND r.returned_at IS NULL
    """)
    
    # Establish IST timezone (Asia/Kolkata is UTC + 5:30)
    ist_tz = timezone(timedelta(hours=5, minutes=30))
    now_ist = datetime.now(timezone.utc).astimezone(ist_tz)
    today_ist = now_ist.date()
    today_str = today_ist.strftime('%Y-%m-%d')
    
    # helper to parse date to IST date object safely
    def parse_to_ist_date(date_str: str) -> date:
        clean_str = date_str.replace("Z", "+00:00")
        try:
            dt = datetime.fromisoformat(clean_str)
        except ValueError:
            dt = datetime.strptime(clean_str[:10], "%Y-%m-%d")
        
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(ist_tz).date()

    approaching = {}
    
    for r in active_loans:
        # Get requested date in IST
        req_date_ist = parse_to_ist_date(r["requested_at"])
        
        # Determine expected return date in IST
        expected_return_date_str = r.get("expected_return_date")
        if expected_return_date_str:
            expected_return_date_ist = parse_to_ist_date(expected_return_date_str)
        else:
            # Check notes for "To Date:" value
            notes_str = r.get("notes") or ""
            to_date_val = None
            if "To Date:" in notes_str:
                for line in notes_str.split("\n"):
                    if line.startswith("To Date:"):
                        to_date_val = line.replace("To Date:", "").strip()
                        break
            if to_date_val:
                expected_return_date_ist = parse_to_ist_date(to_date_val)
            else:
                expected_return_date_ist = req_date_ist + timedelta(days=14)
                
        # Calculate borrow duration
        borrow_duration = (expected_return_date_ist - req_date_ist).days
        if borrow_duration <= 1:
            # Skip if the total borrow duration was only 1 day or less
            continue
            
        # Calculate remaining days dynamically
        days_remaining = (expected_return_date_ist - today_ist).days
        
        # Reminder period: 3 days, 2 days, or 1 day before return due date
        if days_remaining not in [1, 2, 3]:
            continue
            
        # Group them by student email to consolidate
        email = r["student_email"]
        if email and email != "N/A" and "@" in email:
            if email not in approaching:
                approaching[email] = {
                    "student_name": r["student_name"],
                    "student_id": r["student_id"],
                    "items": []
                }
            approaching[email]["items"].append(r)
            
    # Send consolidated emails and log to database for idempotency
    from app.services.email_service import send_brevo_email
    sent_count = 0
    mapping = await get_all_request_codes()
    
    for email, info in approaching.items():
        student_id = info["student_id"]
        student_name = info["student_name"]
        items = info["items"]
        
        # 1. Check if today's reminder has already been successfully sent to this student
        sent_already = await db_query("""
            SELECT 1 FROM reminder_logs 
            WHERE student_id = ? AND reminder_date = ? AND reminder_type = 'deadline_reminder'
        """, [student_id, today_str])
        
        if sent_already:
            print(f"[Cron Reminder] Student {student_name} ({student_id}) already received today's deadline reminder. Skipping.")
            sent_count += 1
            continue
            
        # 2. Build email body table
        items_table_rows = ""
        for it in items:
            req_code = mapping.get(it['id'], f"REQ-{it['id'][:8].upper()}")
            comp_name = it['component_name']
            comp_sku = it.get('component_sku') or f"COMP-{it['component_id'][:4].upper()}"
            qty = it['quantity']
            
            # Format expected return date nicely
            expected_return_date_str = it.get("expected_return_date")
            if expected_return_date_str:
                dt = datetime.fromisoformat(expected_return_date_str.replace("Z", "+00:00"))
                due_date_str = dt.strftime("%d %b %Y")
            else:
                # Fallback parsed notes if expected_return_date is null in request root
                notes_str = it.get("notes") or ""
                to_date_val = None
                if "To Date:" in notes_str:
                    for line in notes_str.split("\n"):
                        if line.startswith("To Date:"):
                            to_date_val = line.replace("To Date:", "").strip()
                            break
                if to_date_val:
                    try:
                        due_date_str = datetime.strptime(to_date_val, "%Y-%m-%d").strftime("%d %b %Y")
                    except Exception:
                        due_date_str = to_date_val
                else:
                    due_date_str = (datetime.fromisoformat(it["requested_at"].replace("Z", "+00:00")) + timedelta(days=14)).strftime("%d %b %Y")
                    
            # Recalculate remaining days for item
            item_deadline_ist = parse_to_ist_date(it.get("expected_return_date") or it["requested_at"])
            item_days_remaining = (item_deadline_ist - today_ist).days
            days_str = f"{item_days_remaining} day" + ("s" if item_days_remaining != 1 else "")
            
            items_table_rows += f"""
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px; border: 1px solid #e2e8f0; color: #1e293b;">
                <strong>{comp_name}</strong><br/>
                <span style="font-size: 11px; color: #64748b;">Code: {comp_sku}</span><br/>
                <span style="font-size: 11px; color: #64748b;">Ref: {req_code}</span>
              </td>
              <td align="right" style="padding: 10px; border: 1px solid #e2e8f0; color: #1e293b;">{qty}</td>
              <td style="padding: 10px; border: 1px solid #e2e8f0; color: #1e293b;">{due_date_str}</td>
              <td align="right" style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold; color: #b45309;">{days_str}</td>
            </tr>
            """
            
        # Determine dynamic subject
        unique_days = list(set((parse_to_ist_date(it.get("expected_return_date") or it["requested_at"]) - today_ist).days for it in items))
        if len(unique_days) == 1:
            days_val = unique_days[0]
            days_word = f"{days_val} Day" + ("s" if days_val != 1 else "")
            subject = f"Return Reminder — Components Due in {days_word}"
        else:
            subject = "Return Reminder — Upcoming Laboratory Component Deadlines"
            
        html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 20px; background-color: #ffffff; color: #1e293b;">
          <div style="text-align: center; margin-bottom: 20px;">
            <div style="display: inline-block; background-color: #fef3c7; padding: 12px; border-radius: 50%; margin-bottom: 10px;">
              <span style="font-size: 24px;">⏰</span>
            </div>
            <h2 style="color: #b45309; margin: 0; font-size: 22px; font-weight: 800;">Return Reminder</h2>
            <p style="font-size: 13px; color: #64748b; margin-top: 5px;">Your borrowed components are approaching their return deadline.</p>
          </div>
          
          <p>Dear {student_name},</p>
          <p>This is a warning that the borrowing period for the following laboratory hardware components issued to you is approaching its return deadline:</p>
          
          <div style="margin: 20px 0; overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px; border: 1px solid #e2e8f0;">
              <thead>
                <tr style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                  <th style="padding: 10px; font-weight: 700; color: #475569; border: 1px solid #e2e8f0;">Component</th>
                  <th style="padding: 10px; font-weight: 700; color: #475569; text-align: right; border: 1px solid #e2e8f0;">Quantity</th>
                  <th style="padding: 10px; font-weight: 700; color: #475569; border: 1px solid #e2e8f0;">Due Date</th>
                  <th style="padding: 10px; font-weight: 700; color: #475569; text-align: right; border: 1px solid #e2e8f0;">Days Remaining</th>
                </tr>
              </thead>
              <tbody>
                {items_table_rows}
              </tbody>
            </table>
          </div>
          
          <p style="font-weight: 700; color: #0f172a; margin-top: 25px;">Please return all listed components to the School of Innovation lab coordinator in functional working condition to avoid overdue flags.</p>
          
          <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 30px; font-size: 11px; color: #64748b; text-align: center;">
            <p>This is an automated notification from the EI HUB Innoventry System.</p>
          </div>
        </div>
        """
        
        # 3. Add app in-app notification
        items_summary = ", ".join([f"{it['quantity']}x {it['component_name']}" for it in items])
        await add_notification(student_id, "Consolidated Return Reminder", f"You have {len(items)} borrowed items approaching deadline: {items_summary}", "warning", "/student/return")
        
        # 4. Dispatch Email and check status
        email_sent = await send_brevo_email(email, subject, html, None)
        if email_sent:
            # 5. Insert to reminder_logs to prevent duplicate daily emailing
            log_id = str(uuid.uuid4())
            await db_execute("""
                INSERT INTO reminder_logs (id, student_id, reminder_date, reminder_type)
                VALUES (?, ?, ?, 'deadline_reminder')
            """, [log_id, student_id, today_str])
            sent_count += 1
            print(f"[Cron Reminder] Reminder email sent & logged successfully for {email}")
        else:
            print(f"[Cron Reminder] Failed to dispatch email for {email}")
            
    return {"reminders_processed": len(approaching), "emails_sent": sent_count}

@app.post("/api/query")
async def execute_query(req: QueryRequest, current_user: dict = Depends(require_admin)):
    try:
        if req.sql.strip().upper().startswith("SELECT"):
            results = await db_query(req.sql, req.args)
            return {"data": results, "error": None}
        else:
            await db_execute(req.sql, req.args)
            return {"data": None, "error": None}
    except Exception as e:
        return {"data": None, "error": {"message": str(e)}}

if __name__ == "__main__":
    import uvicorn
    # Read port from env or default to 8000
    port = int(os.environ.get("PORT", 8000))
    # Production-ready startup: disable reload by default to save resources, enable workers control
    env = os.environ.get("ENV", "production").lower()
    reload_on = env == "development"
    workers = int(os.environ.get("WEB_CONCURRENCY", 1))
    
    print(f"Starting server in {env} mode (port={port}, reload={reload_on}, workers={workers})")
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=reload_on, workers=workers)  # nosec B104


# ==========================================
# ADMIN DATABASE MANAGER (VIEW ONLY)
# ==========================================


import re

def is_valid_table_name(table: str) -> bool:
    if not re.match(r"^[a-zA-Z0-9_]+$", table):
        return False
    if table.startswith("sqlite_") or table.startswith("d1_") or table.startswith("_cf_"):
        return False
    return True

@app.get('/api/admin/system-overview')
async def get_system_overview(user: dict = Depends(require_admin)):
    from datetime import datetime, timedelta, timezone
    
    # 1. Generate date boundaries for the last 30 days ending today (local time)
    # We will use UTC date as base
    today = datetime.now(timezone.utc).date()
    dates = [today - timedelta(days=i) for i in range(29, -1, -1)]
    date_strings = [d.strftime('%Y-%m-%d') for d in dates]
    start_date_str = date_strings[0]
    
    # 2. Fetch starting users count before the start date
    starting_users = 0
    try:
        starting_users_rows = await db_query("SELECT COUNT(*) AS count FROM profiles WHERE created_at IS NULL OR date(created_at) < ?", [start_date_str])
        if starting_users_rows:
            starting_users = starting_users_rows[0].get("count", 0)
    except Exception as e:
        print(f"[System Overview] Querying profiles count failed: {e}")
        try:
            starting_users_rows = await db_query("SELECT COUNT(*) AS count FROM profiles WHERE date(registered_at) < ?", [start_date_str])
            if starting_users_rows:
                starting_users = starting_users_rows[0].get("count", 0)
        except Exception:
            pass

    # 3. Query profiles signups per day
    profiles_rows = []
    try:
        profiles_rows = await db_query("SELECT date(created_at) AS day, COUNT(*) AS count FROM profiles WHERE created_at IS NOT NULL GROUP BY day")
    except Exception as e:
        print(f"[System Overview] Querying profiles per day failed: {e}")
        try:
            profiles_rows = await db_query("SELECT date(registered_at) AS day, COUNT(*) AS count FROM profiles WHERE registered_at IS NOT NULL GROUP BY day")
        except Exception:
            pass

    # 4. Query component requests per day
    requests_rows = []
    try:
        requests_rows = await db_query("SELECT date(requested_at) AS day, COUNT(*) AS count FROM requests WHERE requested_at IS NOT NULL GROUP BY day")
    except Exception as e:
        print(f"[System Overview] Querying requests per day failed: {e}")
        try:
            requests_rows = await db_query("SELECT date(created_at) AS day, COUNT(*) AS count FROM requests WHERE created_at IS NOT NULL GROUP BY day")
        except Exception:
            pass

    # 5. Populate dictionaries for fast matching
    profiles_dict = {}
    for r in profiles_rows:
        day = r.get("day")
        if day:
            day_str = day[:10]
            profiles_dict[day_str] = profiles_dict.get(day_str, 0) + r.get("count", 0)

    requests_dict = {}
    for r in requests_rows:
        day = r.get("day")
        if day:
            day_str = day[:10]
            requests_dict[day_str] = requests_dict.get(day_str, 0) + r.get("count", 0)

    # 6. Build response arrays merging all dates and computing cumulative users
    cumulative_users = starting_users
    labels = []
    users_data = []
    requests_data = []

    for day_str in date_strings:
        d = datetime.strptime(day_str, '%Y-%m-%d').date()
        labels.append(d.strftime('%b %d'))
        
        cumulative_users += profiles_dict.get(day_str, 0)
        users_data.append(cumulative_users)
        
        requests_data.append(requests_dict.get(day_str, 0))

    return {
        "labels": labels,
        "users": users_data,
        "requests": requests_data
    }





# ==========================================
# REPORT PDF GENERATION & EMAIL
# ==========================================
from app.services.pdf_service import (
    generate_inventory_report_pdf,
    generate_low_stock_report_pdf,
    generate_monthly_report_pdf,
    generate_transaction_report_pdf
)

async def fetch_filtered_report_data(
    report_type: str, 
    from_date: Optional[str] = None, 
    to_date: Optional[str] = None
) -> tuple:
    # 1. Build queries
    components_query = "SELECT * FROM components"
    components_params = []
    if from_date or to_date:
        clauses = []
        if from_date:
            clauses.append("created_at >= ?")
            components_params.append(f"{from_date}T00:00:00")
        if to_date:
            clauses.append("created_at <= ?")
            components_params.append(f"{to_date}T23:59:59.999")
        components_query += " WHERE " + " AND ".join(clauses)

    requests_query = """
        SELECT r.*, 
               s.full_name as student_name,
               s.register_number as student_register_no,
               s.department as student_department,
               s.email as student_email,
               s.year_of_study as student_year,
               s.phone as student_phone,
               s.roll_number as student_roll_no,
               s.institution as student_institution,
               c.name as component_name,
               c.category as component_category,
               a.full_name as approver_name,
               ar.full_name as return_reviewed_by_name
        FROM requests r
        LEFT JOIN profiles s ON r.student_id = s.id
        LEFT JOIN components c ON r.component_id = c.id
        LEFT JOIN profiles a ON r.reviewed_by = a.id
        LEFT JOIN profiles ar ON r.return_reviewed_by = ar.id
    """
    requests_params = []
    if from_date or to_date:
        clauses = []
        if from_date:
            clauses.append("r.requested_at >= ?")
            requests_params.append(f"{from_date}T00:00:00")
        if to_date:
            clauses.append("r.requested_at <= ?")
            requests_params.append(f"{to_date}T23:59:59.999")
        requests_query += " WHERE " + " AND ".join(clauses)
    
    requests_query += " ORDER BY r.requested_at DESC"

    # Execute queries concurrently
    components_rows, requests_rows = await asyncio.gather(
        db_query(components_query, components_params),
        db_query(requests_query, requests_params)
    )

    # Process components
    components = []
    for r in components_rows:
        c = dict(r)
        c["sku"] = f"COMP-{c['id'][:4].upper()}"
        c["cabinet"] = c.get("location", "Lab A").split(",")[0].strip() if c.get("location") and "," in c.get("location") else c.get("location", "Lab A")
        c["shelf"] = c.get("location", "Shelf 1").split(",")[1].strip() if c.get("location") and "," in c.get("location") else "Shelf 1"
        components.append(c)

    # Process requests
    requests = []
    mapping = await get_all_request_codes()
    for r in requests_rows:
        req = dict(r)
        req["request_code"] = mapping.get(req["id"], f"REQ-{req['id'][:8].upper()}")
        requests.append(req)

    return components, requests

def generate_csv_report(report_type: str, components: list, requests: list) -> str:
    output = io.StringIO()
    writer = csv.writer(output, lineterminator='\n')
    
    def sanitize(val):
        s = str(val) if val is not None else ""
        if s and s[0] in ('=', '+', '-', '@', '\t', '\r'):
            return "'" + s
        return s
        
    def write_sanitized_row(row_list):
        writer.writerow([sanitize(x) for x in row_list])
    
    if report_type == "Inventory Report":
        write_sanitized_row(["ID", "SKU", "Name", "Category", "Description", "Total Stock", "Available Stock", "Borrowed Stock", "Cabinet", "Shelf", "Location Details", "Unit Cost"])
        for c in components:
            write_sanitized_row([
                c.get("id", ""),
                c.get("sku", ""),
                c.get("name", ""),
                c.get("category", ""),
                c.get("description", ""),
                c.get("total_stock", 0),
                c.get("available_stock", 0),
                c.get("borrowed_stock", 0),
                c.get("cabinet", ""),
                c.get("shelf", ""),
                c.get("location_details", ""),
                c.get("unit_cost", 0.0)
            ])
    else:
        # Transaction log/report
        write_sanitized_row([
            "Transaction ID", "Request Code", "Transaction Type", "Student ID", "Student Name", "Student Email", 
            "Student Register Number", "Student Roll Number", "Student Phone", "Student Department", "Student Year of Study", 
            "Institution", "Component ID", "Component Name", "Component Category", "Component SKU", "Quantity", 
            "Purpose", "Status", "Requested At", "Approved/Rejected By ID", "Approved/Rejected By Name", "Approved/Rejected At", 
            "Approved/Rejected Notes / Reason", "Expected Return At", "Return Requested At", "Returned At", 
            "Return Reviewed By ID", "Return Reviewed By Name", "Return Condition", "Return Description", "Return Remarks"
        ])
        for r in requests:
            write_sanitized_row([
                r.get("id", ""),
                r.get("request_code", ""),
                "Return" if r.get("returned_at") else "Borrow",
                r.get("student_id", ""),
                r.get("student_name", ""),
                r.get("student_email", ""),
                r.get("student_register_no", ""),
                r.get("student_roll_no", ""),
                r.get("student_phone", ""),
                r.get("student_department", ""),
                r.get("student_year", ""),
                r.get("student_institution", ""),
                r.get("component_id", ""),
                r.get("component_name", ""),
                r.get("component_category", ""),
                r.get("component_sku", ""),
                r.get("quantity", 0),
                r.get("purpose", ""),
                r.get("status", ""),
                r.get("requested_at", ""),
                r.get("approved_by", ""),
                r.get("approver_name", ""),
                r.get("approved_at", ""),
                r.get("rejection_reason", ""),
                r.get("expected_return_at", ""),
                r.get("return_requested_at", ""),
                r.get("returned_at", ""),
                r.get("return_reviewed_by", ""),
                r.get("return_reviewed_by_name", ""),
                r.get("return_condition", ""),
                r.get("return_description", ""),
                r.get("return_remarks", "")
            ])
            
    return output.getvalue()

def generate_sql_report(report_type: str, components: list, requests: list, date_range_text: str) -> str:
    sql_lines = []
    sql_lines.append(f"-- EI HUB ENTERPRISE SYSTEM EXPORT")
    sql_lines.append(f"-- Generated On: {datetime.now().strftime('%d %b %Y %H:%M:%S')}")
    sql_lines.append(f"-- Report Type: {report_type}")
    sql_lines.append(f"-- Date Range: {date_range_text}\n")
    
    def esc(val):
        if val is None or val == "":
            return "NULL"
        return f"'{str(val).replace(chr(39), chr(39)+chr(39))}'"
        
    def esc_num(val):
        if val is None or val == "":
            return "NULL"
        return str(val)

    if report_type == "Inventory Report":
        sql_lines.append("CREATE TABLE IF NOT EXISTS components (")
        sql_lines.append(" id VARCHAR(255) PRIMARY KEY,")
        sql_lines.append(" sku VARCHAR(255),")
        sql_lines.append(" name VARCHAR(255),")
        sql_lines.append(" category VARCHAR(255),")
        sql_lines.append(" description TEXT,")
        sql_lines.append(" total_stock INT,")
        sql_lines.append(" available_stock INT,")
        sql_lines.append(" borrowed_stock INT,")
        sql_lines.append(" cabinet VARCHAR(255),")
        sql_lines.append(" shelf VARCHAR(255),")
        sql_lines.append(" location_details VARCHAR(255),")
        sql_lines.append(" unit_cost DECIMAL(10, 2)")
        sql_lines.append(");\n")
        
        for c in components:
            sql_lines.append(
                f"INSERT INTO components (id, sku, name, category, description, total_stock, available_stock, borrowed_stock, cabinet, shelf, location_details, unit_cost) VALUES ("  # nosec B608
                f"{esc(c.get('id'))}, {esc(c.get('sku'))}, {esc(c.get('name'))}, {esc(c.get('category'))}, {esc(c.get('description'))}, "
                f"{esc_num(c.get('total_stock'))}, {esc_num(c.get('available_stock'))}, {esc_num(c.get('borrowed_stock'))}, {esc(c.get('cabinet'))}, {esc(c.get('shelf'))}, {esc(c.get('location_details'))}, {esc_num(c.get('unit_cost'))}"
                f");"
            )
    else:
        sql_lines.append("CREATE TABLE IF NOT EXISTS borrow_requests (")
        sql_lines.append(" id VARCHAR(255) PRIMARY KEY,")
        sql_lines.append(" request_code VARCHAR(255),")
        sql_lines.append(" transaction_type VARCHAR(255),")
        sql_lines.append(" student_id VARCHAR(255),")
        sql_lines.append(" student_name VARCHAR(255),")
        sql_lines.append(" student_email VARCHAR(255),")
        sql_lines.append(" student_register_no VARCHAR(255),")
        sql_lines.append(" student_roll_no VARCHAR(255),")
        sql_lines.append(" student_phone VARCHAR(255),")
        sql_lines.append(" student_department VARCHAR(255),")
        sql_lines.append(" student_year VARCHAR(255),")
        sql_lines.append(" institution VARCHAR(255),")
        sql_lines.append(" component_id VARCHAR(255),")
        sql_lines.append(" component_name VARCHAR(255),")
        sql_lines.append(" component_category VARCHAR(255),")
        sql_lines.append(" component_sku VARCHAR(255),")
        sql_lines.append(" quantity INT,")
        sql_lines.append(" purpose TEXT,")
        sql_lines.append(" status VARCHAR(255),")
        sql_lines.append(" requested_at TIMESTAMP,")
        sql_lines.append(" approved_by_id VARCHAR(255),")
        sql_lines.append(" approved_by_name VARCHAR(255),")
        sql_lines.append(" approved_at TIMESTAMP,")
        sql_lines.append(" approved_rejected_notes TEXT,")
        sql_lines.append(" expected_return_at TIMESTAMP,")
        sql_lines.append(" return_requested_at TIMESTAMP,")
        sql_lines.append(" returned_at TIMESTAMP,")
        sql_lines.append(" return_reviewed_by_id VARCHAR(255),")
        sql_lines.append(" return_reviewed_by_name VARCHAR(255),")
        sql_lines.append(" return_condition VARCHAR(255),")
        sql_lines.append(" return_description TEXT,")
        sql_lines.append(" return_remarks TEXT")
        sql_lines.append(");\n")
        
        for r in requests:
            sql_lines.append(
                f"INSERT INTO borrow_requests (id, request_code, transaction_type, student_id, student_name, student_email, student_register_no, student_roll_no, student_phone, student_department, student_year, institution, component_id, component_name, component_category, component_sku, quantity, purpose, status, requested_at, approved_by_id, approved_by_name, approved_at, approved_rejected_notes, expected_return_at, return_requested_at, returned_at, return_reviewed_by_id, return_reviewed_by_name, return_condition, return_description, return_remarks) VALUES ("  # nosec B608
                f"{esc(r.get('id'))}, {esc(r.get('request_code'))}, {esc('Return' if r.get('returned_at') else 'Borrow')}, {esc(r.get('student_id'))}, {esc(r.get('student_name'))}, {esc(r.get('student_email'))}, {esc(r.get('student_register_no'))}, {esc(r.get('student_roll_no'))}, {esc(r.get('student_phone'))}, {esc(r.get('student_department'))}, {esc(r.get('student_year'))}, {esc(r.get('student_institution'))}, {esc(r.get('component_id'))}, {esc(r.get('component_name'))}, {esc(r.get('component_category'))}, {esc(r.get('component_sku'))}, {esc_num(r.get('quantity'))}, {esc(r.get('purpose'))}, {esc(r.get('status'))}, {esc(r.get('requested_at'))}, {esc(r.get('approved_by'))}, {esc(r.get('approver_name'))}, {esc(r.get('approved_at'))}, {esc(r.get('rejection_reason'))}, {esc(r.get('expected_return_at'))}, {esc(r.get('return_requested_at'))}, {esc(r.get('returned_at'))}, {esc(r.get('return_reviewed_by'))}, {esc(r.get('return_reviewed_by_name'))}, {esc(r.get('return_condition'))}, {esc(r.get('return_description'))}, {esc(r.get('return_remarks'))}"
                f");"
            )
            
    return "\n".join(sql_lines)

async def generate_report_pdf_bytes(
    report_type: str, 
    user: dict, 
    from_date: Optional[str] = None, 
    to_date: Optional[str] = None,
    start_time: Optional[float] = None
) -> bytes:
    if start_time is None:
        start_time = time.time()

    if from_date in [None, "", "null", "undefined"]:
        from_date = None
    if to_date in [None, "", "null", "undefined"]:
        to_date = None

    # Helper to format range text
    def format_date_range(f_date: Optional[str], t_date: Optional[str]) -> str:
        def format_single_date(d_str: str) -> str:
            dt = datetime.strptime(d_str, "%Y-%m-%d")
            return dt.strftime("%d %b %Y")
        if f_date and t_date:
            return f"{format_single_date(f_date)} – {format_single_date(t_date)}"
        elif f_date:
            return f"From {format_single_date(f_date)}"
        elif t_date:
            return f"Until {format_single_date(t_date)}"
        else:
            return "All Time (First to Latest)"

    # Concurrent database retrieval
    components, requests = await fetch_filtered_report_data(report_type, from_date, to_date)
    print(f"[Timing] Database query completion: {time.time() - start_time:.4f}s")

    # Data preparation
    date_range = format_date_range(from_date, to_date)
    generated_by = user.get("name", "Admin")
    stats = {} # Handled dynamically inside Node.js generator
    print(f"[Timing] Data preparation completion: {time.time() - start_time:.4f}s")

    # Call PDF Generator inside ThreadPool to prevent event-loop freezing
    if report_type == "Inventory Report":
        pdf_bytes = await asyncio.to_thread(generate_inventory_report_pdf, components, requests, stats, date_range, generated_by, from_date, to_date)
    elif report_type == "Low Stock Alert":
        pdf_bytes = await asyncio.to_thread(generate_low_stock_report_pdf, components, requests, stats, date_range, generated_by, from_date, to_date)
    elif report_type == "Monthly Summary":
        pdf_bytes = await asyncio.to_thread(generate_monthly_report_pdf, components, requests, stats, date_range, generated_by, from_date, to_date)
    elif report_type == "Transaction Log" or report_type == "Transaction Report":
        pdf_bytes = await asyncio.to_thread(generate_transaction_report_pdf, components, requests, stats, date_range, generated_by, from_date, to_date)
    else:
        pdf_bytes = await asyncio.to_thread(generate_inventory_report_pdf, components, requests, stats, date_range, generated_by, from_date, to_date)
        
    print(f"[Timing] PDF generation completion: {time.time() - start_time:.4f}s")
    return pdf_bytes

@app.get("/api/admin/reports/preview-pdf")
async def preview_report_pdf(
    reportType: str = "Inventory Report", 
    from_date: Optional[str] = None, 
    to_date: Optional[str] = None, 
    user: dict = Depends(require_faculty_or_admin)
):
    start_time = time.time()
    print(f"[Timing] [PDF] API request start")
    if user.get("role") not in ["admin", "super_admin", "faculty"]:
        raise HTTPException(status_code=403, detail="Forbidden")
        
    try:
        pdf_bytes = await generate_report_pdf_bytes(reportType, user, from_date, to_date, start_time)
        print(f"[Timing] [PDF] Response/download start: {time.time() - start_time:.4f}s")
        response = Response(content=pdf_bytes, media_type="application/pdf")
        response.headers["Content-Disposition"] = f"inline; filename=preview.pdf"
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/admin/reports/download-csv")
async def download_report_csv(
    reportType: str = "Inventory Report", 
    from_date: Optional[str] = None, 
    to_date: Optional[str] = None, 
    user: dict = Depends(require_faculty_or_admin)
):
    start_time = time.time()
    print(f"[Timing] [CSV] API request start")
    if user.get("role") not in ["admin", "super_admin", "faculty"]:
        raise HTTPException(status_code=403, detail="Forbidden")
        
    try:
        if from_date in [None, "", "null", "undefined"]:
            from_date = None
        if to_date in [None, "", "null", "undefined"]:
            to_date = None
            
        components, requests = await fetch_filtered_report_data(reportType, from_date, to_date)
        print(f"[Timing] [CSV] Database query completion: {time.time() - start_time:.4f}s")
        
        print(f"[Timing] [CSV] Data preparation completion: {time.time() - start_time:.4f}s")
        
        csv_data = generate_csv_report(reportType, components, requests)
        print(f"[Timing] [CSV] CSV generation completion: {time.time() - start_time:.4f}s")
        
        print(f"[Timing] [CSV] Response/download start: {time.time() - start_time:.4f}s")
        
        response = Response(content=csv_data, media_type="text/csv")
        response.headers["Content-Disposition"] = "attachment; filename=report.csv"
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/admin/reports/download-sql")
async def download_report_sql(
    reportType: str = "Inventory Report", 
    from_date: Optional[str] = None, 
    to_date: Optional[str] = None, 
    user: dict = Depends(require_faculty_or_admin)
):
    start_time = time.time()
    print(f"[Timing] [SQL] API request start")
    if user.get("role") not in ["admin", "super_admin", "faculty"]:
        raise HTTPException(status_code=403, detail="Forbidden")
        
    try:
        if from_date in [None, "", "null", "undefined"]:
            from_date = None
        if to_date in [None, "", "null", "undefined"]:
            to_date = None
            
        components, requests = await fetch_filtered_report_data(reportType, from_date, to_date)
        print(f"[Timing] [SQL] Database query completion: {time.time() - start_time:.4f}s")
        
        # Format single date range text
        def format_date_range(f_date: Optional[str], t_date: Optional[str]) -> str:
            def format_single_date(d_str: str) -> str:
                dt = datetime.strptime(d_str, "%Y-%m-%d")
                return dt.strftime("%d %b %Y")
            if f_date and t_date:
                return f"{format_single_date(f_date)} – {format_single_date(t_date)}"
            elif f_date:
                return f"From {format_single_date(f_date)}"
            elif t_date:
                return f"Until {format_single_date(t_date)}"
            else:
                return "All Time (First to Latest)"
                
        date_range = format_date_range(from_date, to_date)
        print(f"[Timing] [SQL] Data preparation completion: {time.time() - start_time:.4f}s")
        
        sql_data = generate_sql_report(reportType, components, requests, date_range)
        print(f"[Timing] [SQL] SQL generation completion: {time.time() - start_time:.4f}s")
        
        print(f"[Timing] [SQL] Response/download start: {time.time() - start_time:.4f}s")
        
        response = Response(content=sql_data, media_type="application/sql")
        response.headers["Content-Disposition"] = "attachment; filename=report.sql"
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/admin/reports/email-pdf")
async def email_report_pdf(req: EmailReportRequest, user: dict = Depends(require_faculty_or_admin)):
    if user.get("role") not in ["admin", "super_admin", "faculty"]:
        raise HTTPException(status_code=403, detail="Forbidden")
        
    try:
        attachment_list = []
        if req.attachments:
            for att in req.attachments:
                content_b64 = att.get("content", "")
                try:
                    file_bytes = base64.b64decode(content_b64)
                except Exception:
                    raise HTTPException(status_code=400, detail="Invalid base64 encoding for attachment.")
                
                # Check size: 10MB limit
                if len(file_bytes) > 10 * 1024 * 1024:
                    raise HTTPException(status_code=400, detail=f"Attachment {att.get('name')} exceeds the 10MB limit.")
                
                # Sanitize filename & prevent path traversal
                raw_name = att.get("name", "attachment")
                base_name = os.path.basename(raw_name)
                name_part, ext_part = os.path.splitext(base_name)
                clean_name = re.sub(r'[^a-zA-Z0-9._-]', '_', name_part)
                clean_ext = re.sub(r'[^a-zA-Z0-9._-]', '_', ext_part)
                safe_name = clean_name + clean_ext
                if not safe_name:
                    safe_name = "attachment"
                    
                attachment_list.append({
                    "name": safe_name,
                    "content": content_b64
                })
        else:
            # Fallback if no attachments sent (legacy compatibility)
            r_type = req.report_type
            if r_type == "Transaction Report":
                r_type = "Transaction Log"
            pdf_bytes = await generate_report_pdf_bytes(r_type, user, req.from_date, req.to_date)
            b64_pdf = base64.b64encode(pdf_bytes).decode('utf-8')
            filename = f"{r_type.replace(' ', '_')}_{datetime.now().strftime('%Y-%m-%d')}.pdf"
            attachment_list.append({
                "name": filename,
                "content": b64_pdf
            })
        
        html = req.message.replace("\n", "<br>")
        
        success = await send_brevo_email_advanced(
            to_emails=req.to,
            subject=req.subject,
            html_content=html,
            cc_emails=req.cc,
            bcc_emails=req.bcc,
            attachment=attachment_list
        )
        
        if success:
            return {"status": "success", "message": "Email sent"}
        else:
            raise HTTPException(status_code=500, detail="Failed to send email via Brevo")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))




# ==========================================
# COMPONENT CSV IMPORT
# ==========================================

@app.get('/api/admin/components/import/template')
async def get_csv_import_template(user: dict = Depends(require_admin)):
    if user.get("role") not in ["admin", "super_admin", "faculty"]:
        raise HTTPException(status_code=403, detail="Forbidden")
        
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Component ID", "Component Name", "Category", "Description", 
        "Quantity", "Available Quantity", "Unit", "Location", 
        "Manufacturer", "Supplier", "Unit Price", "Reorder Level"
    ])
    writer.writerow([
        "comp-1234", "Arduino Uno R3", "Microcontrollers", "Standard Arduino board", 
        "50", "50", "pcs", "Lab A, Cabinet 1",
        "Arduino", "Robu.in", "1500.00", "10"
    ])
    
    response = Response(content=output.getvalue(), media_type="text/csv")
    response.headers["Content-Disposition"] = "attachment; filename=components_import_template.csv"
    return response

@app.post('/api/admin/components/import/preview')
async def import_csv_preview(file: UploadFile = File(...), user: dict = Depends(require_admin)):
    if user.get("role") not in ["admin", "super_admin", "faculty"]:
        raise HTTPException(status_code=403, detail="Forbidden")
        
    if not file.filename or not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Invalid file format. Please upload a CSV file.")
        
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 5MB.")
    try:
        decoded_content = content.decode('utf-8-sig')
    except UnicodeDecodeError:
        try:
            decoded_content = content.decode('iso-8859-1')
        except:
            raise HTTPException(status_code=400, detail="Could not decode CSV file. Please ensure it is UTF-8 encoded.")
            
    # Use sniffer to detect dialect if possible
    dialect = csv.excel
    try:
        sniffer = csv.Sniffer()
        sample = decoded_content[:1024]
        if sample:
            dialect = sniffer.sniff(sample)
    except Exception:
        pass # fallback to default csv.excel
        
    existing_comps = await db_query("SELECT id, name FROM components")
    existing_names = {c["name"].strip().lower(): c for c in existing_comps if c.get("name")}
    existing_ids = {c["id"].strip(): c for c in existing_comps if c.get("id")}
    
    reader = csv.DictReader(io.StringIO(decoded_content), dialect=dialect)
    headers = [h.strip().lower() for h in (reader.fieldnames or []) if h]
    rows_list = list(reader)
    if len(rows_list) > 5000:
        raise HTTPException(status_code=400, detail="The file contains too many rows. Maximum limit is 5000 rows.")
    
    # Extended Header mapping logic
    header_map = {}
    for h in headers:
        if h in ['component_id', 'id', 'item code', 'code']:
            header_map[h] = 'component_id'
        elif h in ['component name', 'component_name', 'name', 'item name', 'title']:
            header_map[h] = 'name'
        elif h in ['category', 'type', 'group']:
            header_map[h] = 'category'
        elif h in ['quantity', 'qty', 'stock', 'total_stock', 'count']:
            header_map[h] = 'total_stock'
        elif h in ['available quantity', 'available', 'available stock', 'available_stock']:
            header_map[h] = 'available_stock'
        elif h in ['unit', 'unit type', 'uom']:
            header_map[h] = 'unit'
        elif h in ['cabinet', 'location', 'shelf', 'rack']:
            header_map[h] = 'location'
        elif h in ['manufacturer', 'brand']:
            header_map[h] = 'manufacturer'
        elif h in ['supplier', 'vendor']:
            header_map[h] = 'supplier'
        elif h in ['unit price', 'price', 'cost', 'unit_cost']:
            header_map[h] = 'unit_cost'
        elif h in ['reorder level', 'minimum stock', 'reorder_level']:
            header_map[h] = 'reorder_level'
        elif h in ['description', 'desc', 'notes']:
            header_map[h] = 'description'
            
    parsed_rows = []
    stats = {
        "total_rows": 0,
        "valid_rows": 0,
        "invalid_rows": 0,
        "duplicate_rows": 0,
        "update_rows": 0
    }
    
    for row_idx, row in enumerate(rows_list, start=1):
        if not any(row.values()): continue # Skip empty rows
        
        stats["total_rows"] += 1
        
        normalized_row = {
            "component_id": "", "name": "", "category": "General", 
            "description": "", "total_stock": 0, "available_stock": 0,
            "location": "", "unit": "pcs",
            "manufacturer": "", "supplier": "", "unit_cost": 0.0, "reorder_level": 5
        }
        
        for k, v in row.items():
            if not k: continue
            k_lower = k.strip().lower()
            if k_lower in header_map:
                mapped_key = header_map[k_lower]
                normalized_row[mapped_key] = str(v).strip() if v is not None else ""
                
        errors = []
        status = "valid"
        
        # Validation
        if not normalized_row["name"]:
            errors.append("Component name is required")
            
        try:
            stock_str = str(normalized_row["total_stock"]) if normalized_row["total_stock"] else "0"
            stock_val = int(stock_str)
            normalized_row["total_stock"] = stock_val
            if stock_val < 0:
                errors.append("Quantity cannot be negative")
        except ValueError:
            errors.append("Quantity must be numeric")
            normalized_row["total_stock"] = 0
            
        try:
            av_stock_str = str(normalized_row["available_stock"]) if normalized_row["available_stock"] else str(normalized_row["total_stock"])
            av_stock_val = int(av_stock_str)
            normalized_row["available_stock"] = av_stock_val
            if av_stock_val < 0:
                errors.append("Available Quantity cannot be negative")
        except ValueError:
            errors.append("Available Quantity must be numeric")
            normalized_row["available_stock"] = 0

        try:
            cost_str = str(normalized_row["unit_cost"]).replace('$', '').replace(',', '') if normalized_row["unit_cost"] else "0"
            cost_val = float(cost_str)
            normalized_row["unit_cost"] = cost_val
            if cost_val < 0:
                errors.append("Price cannot be negative")
        except ValueError:
            errors.append("Price must be numeric")
            normalized_row["unit_cost"] = 0.0
            
        try:
            rl_str = str(normalized_row["reorder_level"]) if normalized_row["reorder_level"] else "5"
            rl_val = int(rl_str)
            normalized_row["reorder_level"] = rl_val
        except ValueError:
            errors.append("Reorder level must be numeric")
            normalized_row["reorder_level"] = 5
            
        # Duplicate detection
        comp_id = normalized_row.get("component_id", "").strip()
        name_val = normalized_row.get("name", "").strip().lower()
        
        existing_id = None
        if comp_id and comp_id in existing_ids:
            status = "duplicate"
            existing_id = existing_ids[comp_id]["id"]
            if not any(e.startswith("Name") for e in errors):
                errors.append(f"Component ID '{comp_id}' already exists")
        elif name_val and name_val in existing_names:
            status = "duplicate"
            existing_id = existing_names[name_val]["id"]
            if not any(e.startswith("Name") for e in errors):
                errors.append(f"Name '{normalized_row['name']}' already exists")
            
        if errors and status != "duplicate":
            status = "invalid"
            
        if status == "invalid":
            stats["invalid_rows"] += 1
        elif status == "duplicate":
            stats["duplicate_rows"] += 1
        else:
            stats["valid_rows"] += 1
            
        if len(parsed_rows) < 100:
            parsed_rows.append({
                "original_index": row_idx,
                "data": normalized_row,
                "status": status,
                "errors": errors,
                "existing_id": existing_id
            })
        
    return {
        "stats": stats,
        "rows": parsed_rows
    }

@app.post('/api/admin/components/import/confirm')
async def confirm_csv_import(req: ConfirmImportRequest, user: dict = Depends(require_admin)):
    if user.get("role") not in ["admin", "super_admin", "faculty"]:
        raise HTTPException(status_code=403, detail="Forbidden")
        
    imported = 0
    updated = 0
    skipped = 0
    
    now = datetime.now(timezone.utc).replace(tzinfo=None).isoformat() + "Z"
    
    statements = []
    
    for r in req.rows:
        status = r.get("status")
        data = r.get("data")
        existing_id = r.get("existing_id")
        
        if status == "invalid":
            skipped += 1
            continue
            
        if status == "duplicate":
            if req.mode == "skip":
                skipped += 1
                continue
            elif req.mode == "update" and existing_id:
                # Update existing
                statements.append(Statement(
                    '''UPDATE components SET 
                       name = ?, category = ?, description = ?, 
                       total_stock = ?, available_stock = ?, location = ?, unit = ?, 
                       manufacturer = ?, supplier = ?, unit_cost = ?, reorder_level = ?, updated_at = ?
                       WHERE id = ?''',
                    [data["name"], data.get("category", ""), data.get("description", ""),
                     data.get("total_stock", 0), data.get("available_stock", 0),
                     data.get("location", ""), data.get("unit", "pcs"),
                     data.get("manufacturer", ""), data.get("supplier", ""),
                     data.get("unit_cost", 0.0), data.get("reorder_level", 5),
                     now, existing_id]
                ))
                updated += 1
                continue
                
        # Insert new
        comp_id_val = str(data.get("component_id", "")).strip()
        new_id = comp_id_val if comp_id_val else "comp-" + str(uuid.uuid4())[:8]
        sku = comp_id_val if comp_id_val else new_id
        
        statements.append(Statement(
            '''INSERT INTO components (id, sku, name, category, description, total_stock, available_stock, location, unit, manufacturer, supplier, unit_cost, reorder_level, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
            [new_id, sku, data["name"], data.get("category", ""), data.get("description", ""),
             data.get("total_stock", 0), data.get("available_stock", 0),
             data.get("location", ""), data.get("unit", "pcs"),
             data.get("manufacturer", ""), data.get("supplier", ""),
             data.get("unit_cost", 0.0), data.get("reorder_level", 5),
             now, now]
        ))
        imported += 1
        
    if statements:
        await db_batch(statements)
        
    return {
        "status": "success",
        "imported": imported,
        "updated": updated,
        "skipped": skipped
    }


# --- OCR Import Bill (Mocked) ---
@app.post("/api/purchases/import/preview")
async def import_bill_preview(file: UploadFile = File(...), user: dict = Depends(require_admin)):
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 5MB.")
    # Simulate a 1.5 second OCR delay
    await asyncio.sleep(1.5)
    
    # Return a mocked structured response that matches our JSON schema
    return {
        "processing_time_ms": 1540,
        "supplier": {
            "name": "Robu.in Labs",
            "gstin": "27AADCR2329L1Z5",
            "email": "sales@robu.in"
        },
        "invoice": {
            "invoice_number": "INV-2026-99321",
            "date": datetime.now(timezone.utc).strftime("%d-%m-%Y")
        },
        "components": [
            {
                "name": "Raspberry Pi Pico W",
                "hsn_code": "85423100",
                "quantity": 10,
                "unit_price": 550.00,
                "gst_rate": 18,
                "status": "Matched"
            },
            {
                "name": "DHT22 Temperature Sensor",
                "hsn_code": "90318000",
                "quantity": 25,
                "unit_price": 120.00,
                "gst_rate": 18,
                "status": "New"
            },
            {
                "name": "Jumper Wires (F-F) 40pcs",
                "hsn_code": "85444299",
                "quantity": 50,
                "unit_price": 45.00,
                "gst_rate": 18,
                "status": "Similar"
            }
        ],
        "financials": {
            "taxable_value": 10750.00,
            "total_gst": 1935.00,
            "discount": 0.00,
            "grand_total": 12685.00
        }
    }

# Import routes after app definition to avoid circular import
from app.api.routes.import_data import router as import_router
app.include_router(import_router)
