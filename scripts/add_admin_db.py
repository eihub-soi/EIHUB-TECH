import re

def insert_admin_db_endpoints():
    with open('backend/app.py', 'r', encoding='utf-8') as f:
        content = f.read()

    new_endpoints = """

# ==========================================
# ADMIN DATABASE MANAGER (VIEW ONLY)
# ==========================================

ALLOWED_DB_TABLES = {"profiles", "components", "requests", "purchase_orders"}

@app.get("/api/admin/database/tables")
async def get_admin_tables(user: dict = Depends(get_current_user)):
    if user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    return {"tables": list(ALLOWED_DB_TABLES)}

@app.get("/api/admin/database/schema/{table}")
async def get_admin_table_schema(table: str, user: dict = Depends(get_current_user)):
    if user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    if table not in ALLOWED_DB_TABLES:
        raise HTTPException(status_code=400, detail="Invalid table")
    
    # PRAGMA table_info returns (cid, name, type, notnull, dflt_value, pk)
    rows = await db_query(f"PRAGMA table_info({table})")
    schema = [{"name": r["name"], "type": r["type"], "pk": bool(r["pk"])} for r in rows]
    return {"table": table, "schema": schema}

@app.get("/api/admin/database/table/{table}")
async def get_admin_table_data(
    table: str, 
    limit: int = 50, 
    offset: int = 0,
    sortBy: str = "id",
    sortOrder: str = "asc",
    search: str = "",
    user: dict = Depends(get_current_user)
):
    if user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    if table not in ALLOWED_DB_TABLES:
        raise HTTPException(status_code=400, detail="Invalid table")
    
    # Validate sortOrder
    sort_dir = "DESC" if sortOrder.lower() == "desc" else "ASC"
    
    # Pragma to validate sortBy column exists to prevent SQL injection
    schema = await db_query(f"PRAGMA table_info({table})")
    valid_cols = [r["name"] for r in schema]
    if sortBy not in valid_cols:
        sortBy = valid_cols[0] if valid_cols else "id"
        
    where_clause = ""
    args = []
    if search:
        search_clauses = [f"{col} LIKE ?" for col in valid_cols]
        where_clause = "WHERE " + " OR ".join(search_clauses)
        args = [f"%{search}%" for _ in valid_cols]
        
    query = f"SELECT * FROM {table} {where_clause} ORDER BY {sortBy} {sort_dir} LIMIT {limit} OFFSET {offset}"
    count_query = f"SELECT COUNT(*) as count FROM {table} {where_clause}"
    
    rows = await db_query(query, args)
    count_res = await db_query(count_query, args)
    total = count_res[0]["count"] if count_res else 0
    
    return {"table": table, "data": rows, "total": total, "limit": limit, "offset": offset}

import io
import csv
from fastapi.responses import StreamingResponse, Response

@app.get("/api/admin/database/export/csv/{table}")
async def export_table_csv(table: str, user: dict = Depends(get_current_user)):
    if user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    if table not in ALLOWED_DB_TABLES:
        raise HTTPException(status_code=400, detail="Invalid table")
        
    await log_activity(user["uid"], user["name"], "EXPORT_CSV", "DATABASE", table, {}, "info")
    
    rows = await db_query(f"SELECT * FROM {table}")
    if not rows:
        return Response("No data", media_type="text/plain")
        
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=rows[0].keys())
    writer.writeheader()
    for row in rows:
        writer.writerow(row)
        
    response = StreamingResponse(iter([output.getvalue()]), media_type="text/csv")
    response.headers["Content-Disposition"] = f"attachment; filename={table}_export.csv"
    return response

@app.get("/api/admin/database/export/sql/{table}")
async def export_table_sql(table: str, user: dict = Depends(get_current_user)):
    if user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    if table not in ALLOWED_DB_TABLES:
        raise HTTPException(status_code=400, detail="Invalid table")
        
    await log_activity(user["uid"], user["name"], "EXPORT_SQL", "DATABASE", table, {}, "info")
    
    rows = await db_query(f"SELECT * FROM {table}")
    schema_rows = await db_query(f"PRAGMA table_info({table})")
    
    sql_lines = [f"-- SQL Dump for table: {table}\\n"]
    if schema_rows:
        cols = []
        for r in schema_rows:
            col_def = f"{r['name']} {r['type']}"
            if r['pk']:
                col_def += " PRIMARY KEY"
            cols.append(col_def)
        sql_lines.append(f"CREATE TABLE IF NOT EXISTS {table} (\\n    " + ",\\n    ".join(cols) + "\\n);\\n")
    
    if rows:
        keys = rows[0].keys()
        columns_str = ", ".join(keys)
        for row in rows:
            values = []
            for k in keys:
                v = row[k]
                if v is None:
                    values.append("NULL")
                elif isinstance(v, (int, float)):
                    values.append(str(v))
                else:
                    v_str = str(v).replace("'", "''")
                    values.append(f"'{v_str}'")
            val_str = ", ".join(values)
            sql_lines.append(f"INSERT INTO {table} ({columns_str}) VALUES ({val_str});")
            
    response = StreamingResponse(iter(["\\n".join(sql_lines)]), media_type="application/sql")
    response.headers["Content-Disposition"] = f"attachment; filename={table}_export.sql"
    return response

@app.get("/api/admin/database/export/pdf/{table}")
async def export_table_pdf(table: str, user: dict = Depends(get_current_user)):
    if user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    if table not in ALLOWED_DB_TABLES:
        raise HTTPException(status_code=400, detail="Invalid table")
        
    await log_activity(user["uid"], user["name"], "EXPORT_PDF", "DATABASE", table, {}, "info")
    
    rows = await db_query(f"SELECT * FROM {table}")
    
    try:
        from fpdf import FPDF
    except ImportError:
        return Response("PDF generation requires fpdf2", status_code=500)
        
    pdf = FPDF(orientation="P", unit="mm", format="A4")
    pdf.add_page()
    pdf.set_font("helvetica", "B", 16)
    pdf.cell(0, 10, "EI HUB Innoventry - Database Export", new_x="LMARGIN", new_y="NEXT", align="C")
    
    pdf.set_font("helvetica", "", 10)
    pdf.cell(0, 8, f"Table: {table}", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 8, f"Total Rows: {len(rows)}", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 8, f"Export Timestamp: {datetime.now(timezone.utc).replace(tzinfo=None).isoformat()}Z", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(5)
    
    if not rows:
        pdf.cell(0, 10, "No data available", new_x="LMARGIN", new_y="NEXT")
    else:
        pdf.set_font("helvetica", "B", 8)
        keys = list(rows[0].keys())
        col_width = 190 / len(keys) if keys else 190
        
        for key in keys:
            pdf.cell(col_width, 8, str(key)[:15], border=1)
        pdf.ln()
        
        pdf.set_font("helvetica", "", 7)
        for row in rows:
            for key in keys:
                val = str(row[key])[:20] if row[key] is not None else "NULL"
                pdf.cell(col_width, 6, val, border=1)
            pdf.ln()
            
    pdf_bytes = pdf.output()
    response = Response(content=pdf_bytes, media_type="application/pdf")
    response.headers["Content-Disposition"] = f"attachment; filename={table}_export.pdf"
    return response

"""
    
    # Append at the bottom, just before the closing app definition if any
    content += new_endpoints
    
    with open('backend/app.py', 'w', encoding='utf-8') as f:
        f.write(content)

insert_admin_db_endpoints()
