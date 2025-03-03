import dotenv from "dotenv";
dotenv.config();
import pg from "pg";
const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false,
    },
});

await pool.query(`
  CREATE TABLE IF NOT EXISTS sessions (
    access_key TEXT PRIMARY KEY,
    session_data JSONB NOT NULL
  );
`);

export async function saveSession(accessKey: string, sessionData: object): Promise<void> {
    await pool.query("INSERT INTO sessions (access_key, session_data) VALUES ($1, $2) ON CONFLICT (access_key) DO UPDATE SET session_data = $2", [accessKey, sessionData]);
}

export async function getSession(accessKey: string): Promise<object | null> {
    const result = await pool.query("SELECT session_data FROM sessions WHERE access_key = $1", [accessKey]);
    return result.rows[0]?.session_data || null;
}

export async function getAllSessions(): Promise<{ access_key: string; session_data: object }[]> {
    const result = await pool.query("SELECT access_key, session_data FROM sessions");
    return result.rows;
}

export async function clearAllSessions(): Promise<void> {
    await pool.query("DELETE FROM sessions");
}
