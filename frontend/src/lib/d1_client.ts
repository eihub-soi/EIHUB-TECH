// D1 HTTP API Client (Replaces D1 client)
// This proxy forwards all queries to the FastAPI backend at /api/query

export const isD1Configured = true;

function cleanRow(tableName: string, row: any) {
  if (!row) return null;
  const cleaned: any = { ...row };

  if (tableName === "profiles") {
    if (cleaned.is_active !== undefined) {
      cleaned.is_active = Boolean(cleaned.is_active);
    }
    if (cleaned.email_verified !== undefined) {
      cleaned.email_verified = Boolean(cleaned.email_verified);
    }
  }

  if (tableName === "system_settings" && typeof cleaned.value === "string") {
    try {
      cleaned.value = JSON.parse(cleaned.value);
    } catch {}
  }

  return cleaned;
}

class D1QueryBuilder {
  private tableName: string;
  private selectColumns: string = "*";
  private filters: string[] = [];
  private filterParams: any[] = [];
  private orderBy: string = "";
  private limitValue: number | null = null;
  private offsetValue: number | null = null;
  private isSingle: boolean = false;
  private operation: "select" | "insert" | "update" | "delete" = "select";
  private insertData: any = null;
  private updateData: any = null;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  select(columns: string = "*") {
    this.operation = "select";
    this.selectColumns = columns;
    return this;
  }

  insert(data: any) {
    this.operation = "insert";
    this.insertData = data;
    return this;
  }

  update(data: any) {
    this.operation = "update";
    this.updateData = data;
    return this;
  }

  delete() {
    this.operation = "delete";
    return this;
  }

  eq(col: string, val: any) {
    let arg = val;
    if (typeof val === "boolean") {
      arg = val ? 1 : 0;
    }
    this.filters.push(`"${col}" = ?`);
    this.filterParams.push(arg);
    return this;
  }

  like(col: string, val: any) {
    this.filters.push(`"${col}" LIKE ?`);
    this.filterParams.push(val);
    return this;
  }

  neq(col: string, val: any) {
    let arg = val;
    if (typeof val === "boolean") {
      arg = val ? 1 : 0;
    }
    this.filters.push(`"${col}" != ?`);
    this.filterParams.push(arg);
    return this;
  }

  or(expr: string) {
    const parts = expr.split(",");
    const orFilters: string[] = [];
    parts.forEach((part) => {
      const subparts = part.split(".eq.");
      if (subparts.length === 2) {
        orFilters.push(`"${subparts[0]}" = ?`);
        this.filterParams.push(subparts[1]);
      }
    });
    if (orFilters.length > 0) {
      this.filters.push(`(${orFilters.join(" OR ")})`);
    }
    return this;
  }

  order(col: string, { ascending = true } = {}) {
    this.orderBy = `ORDER BY "${col}" ${ascending ? "ASC" : "DESC"}`;
    return this;
  }

  limit(num: number) {
    this.limitValue = num;
    return this;
  }

  range(start: number, end: number) {
    this.limitValue = end - start + 1;
    this.offsetValue = start;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  private async fetchQuery(sql: string, args: any[]) {
    const token = localStorage.getItem("ei_hub_auth_token") || localStorage.getItem("ei_hub_active_user_id") || "";
    const response = await fetch("/api/query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token ? `Bearer ${token}` : "",
      },
      body: JSON.stringify({ sql, args }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem("ei_hub_auth_token");
        // We let AuthContext or ProtectedRoute handle the redirect to avoid false positives during initialization
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    if (result.error) {
      throw new Error(result.error.message || "Unknown error");
    }
    return result.data;
  }

  async execute() {
    try {
      if (this.operation === "select") {
        if (
          this.tableName === "requests" &&
          this.selectColumns.includes("student:profiles")
        ) {
          let sql = `
 SELECT 
 r.id, r.student_id, r.component_id, r.quantity, r.status, 
 r.notes, r.reject_reason, r.requested_at, r.reviewed_by, r.reviewed_at, 
 r.return_requested_at, r.returned_at, r.return_reviewed_by,
 p.full_name AS student_full_name, p.register_number AS student_register_number, p.department AS student_department, p.email AS student_email,
 c.name AS component_name, c.category AS component_category, c.image_url AS component_image_url,
 appr.full_name AS approver_full_name
 FROM requests r
 LEFT JOIN profiles p ON r.student_id = p.id
 LEFT JOIN components c ON r.component_id = c.id
 LEFT JOIN profiles appr ON r.reviewed_by = appr.id
 `;

          const mappedFilters = this.filters.map((f) => {
            return f
              .replace(/^"id"/, 'r."id"')
              .replace(/^"student_id"/, 'r."student_id"')
              .replace(/^"component_id"/, 'r."component_id"')
              .replace(/^"status"/, 'r."status"');
          });

          if (mappedFilters.length > 0) {
            sql += ` WHERE ${mappedFilters.join(" AND ")}`;
          }
          if (this.orderBy) {
            sql += ` ${this.orderBy.replace(/"id"/, 'r."id"').replace(/"created_at"/, 'r."requested_at"')}`;
          }
          if (this.limitValue !== null) {
            sql += ` LIMIT ${this.limitValue}`;
            if (this.offsetValue !== null) {
              sql += ` OFFSET ${this.offsetValue}`;
            }
          }

          const rows = (await this.fetchQuery(sql, this.filterParams)) || [];

          const formatted = rows.map((row: any) => ({
            id: row.id,
            student_id: row.student_id,
            component_id: row.component_id,
            quantity: Number(row.quantity),
            status: row.status,
            requested_at: row.requested_at,
            reviewed_at: row.reviewed_at,
            reviewed_by: row.reviewed_by,
            return_requested_at: row.return_requested_at,
            returned_at: row.returned_at,
            return_reviewed_by: row.return_reviewed_by,
            reject_reason: row.reject_reason,
            notes: row.notes,
            student: {
              full_name: row.student_full_name,
              register_number: row.student_register_number,
              department: row.student_department,
              email: row.student_email,
            },
            approver: row.approver_full_name
              ? {
                  full_name: row.approver_full_name,
                }
              : null,
            component: {
              name: row.component_name,
              category: row.component_category,
              image_url: row.component_image_url,
            },
          }));

          if (this.isSingle) {
            return { data: formatted[0] || null, error: null };
          }
          return { data: formatted, error: null };
        }

        let sql = `SELECT ${this.selectColumns} FROM "${this.tableName}"`;
        if (this.filters.length > 0) {
          sql += ` WHERE ${this.filters.join(" AND ")}`;
        }
        if (this.orderBy) {
          sql += ` ${this.orderBy}`;
        }
        if (this.limitValue !== null) {
          sql += ` LIMIT ${this.limitValue}`;
          if (this.offsetValue !== null) {
            sql += ` OFFSET ${this.offsetValue}`;
          }
        }

        const rows = (await this.fetchQuery(sql, this.filterParams)) || [];
        const cleanedRows = rows.map((row: any) =>
          cleanRow(this.tableName, row),
        );

        if (this.isSingle) {
          return { data: cleanedRows[0] || null, error: null };
        }
        return { data: cleanedRows, error: null };
      }

      if (this.operation === "insert") {
        const rows = Array.isArray(this.insertData)
          ? this.insertData
          : [this.insertData];
        if (rows.length === 0) {
          return { data: [], error: null };
        }

        const keys = Object.keys(rows[0]);
        const placeholders: string[] = [];
        const params: any[] = [];

        rows.forEach((row) => {
          placeholders.push(`(${keys.map(() => "?").join(", ")})`);
          keys.forEach((key) => {
            let val = row[key];
            if (val === undefined) {
              val = null;
            } else if (typeof val === "boolean") {
              val = val ? 1 : 0;
            } else if (val !== null && typeof val === "object") {
              val = JSON.stringify(val);
            }
            params.push(val);
          });
        });

        const sql = `INSERT INTO "${this.tableName}" (${keys.map((k) => `"${k}"`).join(", ")}) VALUES ${placeholders.join(", ")}`;
        await this.fetchQuery(sql, params);
        return { data: this.insertData, error: null };
      }

      if (this.operation === "update") {
        const keys = Object.keys(this.updateData);
        if (keys.length === 0) {
          return { data: null, error: null };
        }

        const setClause = keys.map((k) => `"${k}" = ?`).join(", ");
        const params = keys.map((k) => {
          let val = this.updateData[k];
          if (val === undefined) {
            val = null;
          } else if (typeof val === "boolean") {
            val = val ? 1 : 0;
          } else if (val !== null && typeof val === "object") {
            val = JSON.stringify(val);
          }
          return val;
        });

        let sql = `UPDATE "${this.tableName}" SET ${setClause}`;
        if (this.filters.length > 0) {
          sql += ` WHERE ${this.filters.join(" AND ")}`;
        }

        const allParams = [...params, ...this.filterParams];
        await this.fetchQuery(sql, allParams);
        return { data: this.updateData, error: null };
      }

      if (this.operation === "delete") {
        let sql = `DELETE FROM "${this.tableName}"`;
        if (this.filters.length > 0) {
          sql += ` WHERE ${this.filters.join(" AND ")}`;
        }
        await this.fetchQuery(sql, this.filterParams);
        return { data: null, error: null };
      }

      throw new Error("Unsupported database operation");
    } catch (err: any) {
      console.error(
        "[D1 Wrapper Error in", this.tableName + "]:",
        err.message || err,
      );
      return { data: null, error: { message: err.message || err } };
    }
  }

  then(
    onfulfilled?: (value: any) => any,
    onrejected?: (reason: any) => any,
  ): Promise<any> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

export const d1 = {
  from(tableName: string) {
    return new D1QueryBuilder(tableName);
  },

  channel(name: string) {
    const mockChannel = {
      on(event: string, filter: any, callback: any) {
        return mockChannel;
      },
      subscribe(callback?: any) {
        if (callback) {
          setTimeout(() => callback("SUBSCRIBED"), 0);
        }
        return {
          unsubscribe() {},
        };
      },
    };
    return mockChannel;
  },

  // Mock Authentication handler
  auth: {
    async getSession() {
      const sessionStr = localStorage.getItem("d1_auth_session");
      if (sessionStr) {
        try {
          const session = JSON.parse(sessionStr);
          return { data: { session }, error: null };
        } catch {}
      }
      return { data: { session: null }, error: null };
    },

    onAuthStateChange(callback: (event: string, session: any) => void) {
      const handler = () => {
        const sessionStr = localStorage.getItem("d1_auth_session");
        const session = sessionStr ? JSON.parse(sessionStr) : null;
        callback("SIGNED_IN", session);
      };
      window.addEventListener("d1_auth_change", handler);

      const sessionStr = localStorage.getItem("d1_auth_session");
      const session = sessionStr ? JSON.parse(sessionStr) : null;
      setTimeout(() => callback("INITIAL_SESSION", session), 0);

      return {
        data: {
          subscription: {
            unsubscribe() {
              window.removeEventListener("d1_auth_change", handler);
            },
          },
        },
      };
    },

    async signInWithPassword({ email, password }: any) {
      return { data: null as any, error: { message: "Please use Firebase Authentication instead." } };
    },

    async signUp({ email, password }: any) {
      return { data: null as any, error: { message: "Please use Firebase Authentication instead." } };
    },

    async resetPassword(email: string, newPassword: string) {
      return { error: { message: "Please use Firebase Authentication instead." } };
    },

    async signOut() {
      localStorage.removeItem("d1_auth_session");
      window.dispatchEvent(new Event("d1_auth_change"));
      return { error: null };
    },
  },
};

export const client = {
  async execute({ sql, args }: { sql: string; args?: any[] }) {
    const token = localStorage.getItem("ei_hub_auth_token") || localStorage.getItem("ei_hub_active_user_id") || "";
    const response = await fetch("/api/query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token ? `Bearer ${token}` : "",
      },
      body: JSON.stringify({ sql, args: args || [] }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    if (result.error) {
      throw new Error(result.error.message || "Unknown error");
    }
    // Return the data as 'rows' array as expected by the consumers
    return { rows: result.data || [] };
  },
};
