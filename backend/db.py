import sqlite3
import json
import os
from datetime import datetime

DB_PATH = os.getenv("DB_PATH", "./redline.db")


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn

def _get_conn_update():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS sessions (
            id          TEXT PRIMARY KEY,
            name        TEXT NOT NULL,
            description TEXT,
            created_at  TEXT NOT NULL,
            updated_at  TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS attacks (
            id                 TEXT PRIMARY KEY,
            session_id         TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
            category           TEXT NOT NULL,
            technique          TEXT NOT NULL,
            base_prompt        TEXT,
            evolved_prompt     TEXT,
            active_prompt      TEXT NOT NULL,
            response           TEXT,
            status             TEXT,
            success_score      REAL,
            failure_signals    TEXT,
            provider           TEXT NOT NULL,
            model              TEXT NOT NULL,
            elapsed_seconds    REAL,
            evolution_strategy TEXT,
            timestamp          TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_attacks_session   ON attacks(session_id);
        CREATE INDEX IF NOT EXISTS idx_attacks_timestamp ON attacks(timestamp);
        CREATE INDEX IF NOT EXISTS idx_attacks_status    ON attacks(status);
    """)
    conn.commit()
    conn.close()

def create_session(session_id, name, description=""):
    now = datetime.utcnow().isoformat()
    conn = get_db()
    conn.execute("INSERT INTO sessions (id,name,description,created_at,updated_at) VALUES (?,?,?,?,?)",
                 (session_id, name, description, now, now))
    conn.commit(); conn.close()
    return get_session(session_id)

def get_session(session_id):
    conn = get_db()
    row = conn.execute("SELECT * FROM sessions WHERE id=?", (session_id,)).fetchone()
    conn.close()
    if not row: return None
    s = dict(row); s["attack_count"] = get_session_attack_count(session_id)
    return s

def list_sessions():
    conn = get_db()
    rows = conn.execute("SELECT * FROM sessions ORDER BY updated_at DESC").fetchall()
    conn.close()
    result = []
    for row in rows:
        s = dict(row); s["attack_count"] = get_session_attack_count(s["id"])
        result.append(s)
    return result

def delete_session(session_id):
    conn = get_db()
    conn.execute("DELETE FROM sessions WHERE id=?", (session_id,))
    conn.commit(); conn.close()

def get_session_attack_count(session_id):
    conn = get_db()
    c = conn.execute("SELECT COUNT(*) FROM attacks WHERE session_id=?", (session_id,)).fetchone()[0]
    conn.close(); return c

def touch_session(session_id):
    conn = get_db()
    conn.execute("UPDATE sessions SET updated_at=? WHERE id=?", (datetime.utcnow().isoformat(), session_id))
    conn.commit(); conn.close()

def save_attack(attack):
    conn = get_db()
    conn.execute("""INSERT INTO attacks
        (id,session_id,category,technique,base_prompt,evolved_prompt,active_prompt,
         response,status,success_score,failure_signals,provider,model,elapsed_seconds,
         evolution_strategy,timestamp) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (attack["id"],attack["session_id"],attack["category"],attack["technique"],
         attack.get("base_prompt"),attack.get("evolved_prompt"),attack["active_prompt"],
         attack.get("response"),attack.get("status"),attack.get("success_score"),
         json.dumps(attack.get("failure_signals")),attack["provider"],attack["model"],
         attack.get("elapsed_seconds"),attack.get("evolution_strategy"),attack["timestamp"]))
    conn.commit(); conn.close()
    touch_session(attack["session_id"])
    return get_attack(attack["id"])

def get_attack(attack_id):
    conn = get_db()
    row = conn.execute("SELECT * FROM attacks WHERE id=?", (attack_id,)).fetchone()
    conn.close()
    if not row: return None
    a = dict(row)
    if a.get("failure_signals"): a["failure_signals"] = json.loads(a["failure_signals"])
    return a

def list_attacks(session_id, limit=100):
    conn = get_db()
    rows = conn.execute("SELECT * FROM attacks WHERE session_id=? ORDER BY timestamp DESC LIMIT ?",
                        (session_id, limit)).fetchall()
    conn.close()
    attacks = []
    for row in rows:
        a = dict(row)
        if a.get("failure_signals"): a["failure_signals"] = json.loads(a["failure_signals"])
        attacks.append(a)
    return attacks

def get_metrics(session_id=None):
    conn = get_db()
    where = "WHERE session_id=?" if session_id else ""
    params = (session_id,) if session_id else ()
    total = conn.execute(f"SELECT COUNT(*) FROM attacks {where}", params).fetchone()[0]
    if total == 0:
        conn.close()
        return {"total_attacks":0,"compliance_rate":0,"block_rate":0,"avg_score":0,
                "by_status":{},"by_category":{},"top_techniques":[]}
    avg_score = conn.execute(
        f"SELECT AVG(success_score) FROM attacks {where} {'AND' if where else 'WHERE'} success_score IS NOT NULL",
        params).fetchone()[0] or 0
    by_status = {}
    for row in conn.execute(f"SELECT status,COUNT(*) as c FROM attacks {where} GROUP BY status", params).fetchall():
        by_status[row["status"] or "UNKNOWN"] = row["c"]
    by_category = {}
    for row in conn.execute(f"SELECT category,COUNT(*) as c,AVG(success_score) as avg FROM attacks {where} GROUP BY category", params).fetchall():
        by_category[row["category"]] = {"count": row["c"], "avg_score": round(row["avg"] or 0, 3)}
    top_techniques = []
    sep = "AND" if where else "WHERE"
    for row in conn.execute(f"""SELECT technique,category,COUNT(*) as c,AVG(success_score) as avg
        FROM attacks {where} {sep} success_score IS NOT NULL
        GROUP BY technique ORDER BY avg DESC LIMIT 5""", params).fetchall():
        top_techniques.append({"technique":row["technique"],"category":row["category"],
                                "count":row["c"],"avg_score":round(row["avg"] or 0,3)})
    conn.close()
    complied = by_status.get("COMPLIED",0); blocked = by_status.get("BLOCKED",0)
    return {"total_attacks":total,"compliance_rate":round(complied/total,3),
            "block_rate":round(blocked/total,3),"avg_score":round(avg_score,3),
            "by_status":by_status,"by_category":by_category,"top_techniques":top_techniques}
