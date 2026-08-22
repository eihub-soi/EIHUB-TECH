import subprocess
import json
import os
from typing import List, Dict, Any, Optional

BANNER_CACHE = None

def get_pdf_banner() -> str:
    global BANNER_CACHE
    if BANNER_CACHE is None:
        try:
            current_dir = os.path.dirname(os.path.abspath(__file__))
            banner_path = os.path.abspath(os.path.join(current_dir, "..", "..", "..", "frontend", "src", "utils", "pdfBanner.ts"))
            if os.path.exists(banner_path):
                with open(banner_path, "r", encoding="utf-8") as f:
                    content = f.read()
                start_idx = content.find("base64,") + 7
                end_idx = content.find('"', start_idx)
                if end_idx == -1:
                    end_idx = content.find("'", start_idx)
                if start_idx != -1 and end_idx != -1:
                    BANNER_CACHE = content[start_idx:end_idx].strip()
                    print("[PDF Banner Cache] Successfully cached PDF banner.")
            else:
                print(f"[PDF Banner Cache Warning] Banner path does not exist: {banner_path}")
        except Exception as e:
            print(f"[PDF Banner Cache Warning] Failed to cache banner: {e}")
    return BANNER_CACHE or ""

def run_node_pdf_generator(
    report_type: str, 
    components: List[Dict[str, Any]], 
    requests: List[Dict[str, Any]], 
    stats: Dict[str, Any], 
    date_range: str, 
    generated_by: str,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None
) -> bytes:
    # Build input payload matching generate_pdf.js expected fields
    payload = {
        "reportType": report_type,
        "components": components,
        "requests": requests,
        "stats": stats,
        "userRole": "admin", # Default
        "userName": generated_by,
        "dateRangeText": date_range,
        "fromDate": from_date,
        "toDate": to_date,
        "pdfBannerBase64": get_pdf_banner()
    }
    
    # Paths
    current_dir = os.path.dirname(os.path.abspath(__file__))
    node_script = os.path.join(current_dir, "generate_pdf.js")
    
    # Resolve node_modules path from frontend
    env = os.environ.copy()
    frontend_node_modules = os.path.abspath(os.path.join(current_dir, "..", "..", "..", "frontend", "node_modules"))
    env["NODE_PATH"] = frontend_node_modules
    
    # Run Node.js process and pipe JSON
    proc = subprocess.Popen(
        ["node", node_script],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=env
    )
    
    stdout, stderr = proc.communicate(input=json.dumps(payload).encode('utf-8'))
    
    if proc.returncode != 0:
        err_msg = stderr.decode('utf-8', errors='ignore')
        print(f"[PDF Gen Error] Node process failed with code {proc.returncode}: {err_msg}")
        raise Exception(f"PDF Generator failed: {err_msg}")
        
    return stdout

def generate_inventory_report_pdf(
    components: List[Dict[str, Any]], 
    requests: List[Dict[str, Any]], 
    stats: Dict[str, Any], 
    date_range: str, 
    generated_by: str,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None
) -> bytes:
    return run_node_pdf_generator("Inventory Report", components, requests, stats, date_range, generated_by, from_date, to_date)

def generate_low_stock_report_pdf(
    components: List[Dict[str, Any]], 
    requests: List[Dict[str, Any]], 
    stats: Dict[str, Any], 
    date_range: str, 
    generated_by: str,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None
) -> bytes:
    return run_node_pdf_generator("Low Stock Alert", components, requests, stats, date_range, generated_by, from_date, to_date)

def generate_monthly_report_pdf(
    components: List[Dict[str, Any]], 
    requests: List[Dict[str, Any]], 
    stats: Dict[str, Any], 
    date_range: str, 
    generated_by: str,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None
) -> bytes:
    return run_node_pdf_generator("Monthly Summary", components, requests, stats, date_range, generated_by, from_date, to_date)

def generate_transaction_report_pdf(
    components: List[Dict[str, Any]], 
    requests: List[Dict[str, Any]], 
    stats: Dict[str, Any], 
    date_range: str, 
    generated_by: str,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None
) -> bytes:
    return run_node_pdf_generator("Transaction Log", components, requests, stats, date_range, generated_by, from_date, to_date)
