import json
from fastapi import FastAPI, Request, Response, HTTPException, Depends
from fastapi.testclient import TestClient
from pydantic import BaseModel

app = FastAPI()

class ResetLinkRequest(BaseModel):
    email: str

@app.middleware("http")
async def strict_email_validation_middleware(request: Request, call_next):
    if request.url.path in ["/docs", "/redoc", "/openapi.json"]:
        return await call_next(request)

    for k, v in request.query_params.items():
        if "email" in k.lower() and v and any(c.isupper() for c in v):
            return Response(
                content=json.dumps({"error": "Email address must contain only lowercase letters."}),
                status_code=400,
                media_type="application/json"
            )

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

            async def receive():
                return {"type": "http.request", "body": body_bytes, "more_body": False}
            request._receive = receive

    return await call_next(request)

async def get_current_user_mock(email: str):
    if email and any(c.isupper() for c in email):
        raise HTTPException(status_code=400, detail="Email address must contain only lowercase letters.")
    return {"email": email}

@app.post("/api/auth/reset-link")
async def get_firebase_reset_link(req: ResetLinkRequest):
    if req.email and any(c.isupper() for c in req.email):
        raise HTTPException(status_code=400, detail="Email address must contain only lowercase letters.")
    return {"status": "ok"}

@app.get("/api/user")
async def get_user_endpoint(user: dict = Depends(get_current_user_mock)):
    return user

client = TestClient(app)

def test_email_validation():
    cases = [
        ("user@kgkite.ac.in", True),
        ("User@kgkite.ac.in", False),
        ("USER@kgkite.ac.in", False),
        ("user@KGKITE.AC.IN", False),
        ("UsEr@kgkite.ac.in", False),
        ("student@kgkite.ac.in", True),
    ]

    for email, expected_accepted in cases:
        res = client.post("/api/auth/reset-link", json={"email": email})
        if expected_accepted:
            assert res.status_code == 200, f"Expected 200 for {email}, got {res.status_code}"
        else:
            assert res.status_code == 400, f"Expected 400 for {email}, got {res.status_code}"
            assert res.json()["error"] == "Email address must contain only lowercase letters.", f"Expected error message, got {res.text}"

        res = client.get(f"/api/user?email={email}")
        if expected_accepted:
            assert res.status_code == 200, f"Expected 200 for {email}, got {res.status_code}"
        else:
            assert res.status_code == 400, f"Expected rejection for {email}, got {res.status_code}"
            assert res.json()["error"] == "Email address must contain only lowercase letters.", f"Expected error message, got {res.text}"

    print("All backend email validation unit tests passed successfully!")

if __name__ == "__main__":
    test_email_validation()
