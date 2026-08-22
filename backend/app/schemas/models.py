from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class ResetLinkRequest(BaseModel):
    email: str

class ActivityLogCreate(BaseModel):
    user_id: str
    user_name: str
    action: str
    entity_type: str
    entity_id: str
    details: dict = {}
    status: str = 'success'

class QueryRequest(BaseModel):
    sql: str
    args: list = []

class EmailReportRequest(BaseModel):
    report_type: str
    to: List[str]
    cc: Optional[List[str]] = []
    bcc: Optional[List[str]] = []
    subject: str
    message: str
    from_date: Optional[str] = None
    to_date: Optional[str] = None
    attachments: Optional[List[Dict[str, str]]] = []

class ConfirmImportRequest(BaseModel):
    rows: list
    mode: str = 'skip'

