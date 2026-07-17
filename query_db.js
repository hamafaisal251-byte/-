import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/sovereign_db";

async function main() {
  const pool = new pg.Pool({ connectionString });
  try {
    const resTables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log("Tables in database:", resTables.rows.map(r => r.table_name));

    for (const table of resTables.rows.map(r => r.table_name)) {
      const countRes = await pool.query(`SELECT COUNT(*) as count FROM "${table}"`);
      console.log(`Table "${table}" row count:`, countRes.rows[0].count);
    }
  } catch (err) {
    console.error("Failed to query DB:", err);
  } finally {
    await pool.end();
  }
}

main();
