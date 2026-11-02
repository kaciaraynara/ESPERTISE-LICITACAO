const { Pool } = require('pg');
require('dotenv').config({ path: __dirname + '/../.env' });

async function fix() {
  const connStr = process.env.DIRECT_URL || process.env.DATABASE_URL;
  console.log('Connecting to DB...');
  const pool = new Pool({ connectionString: connStr });
  try {
    await pool.query(`ALTER TABLE procurement_notices ADD COLUMN IF NOT EXISTS numero_controle_pncp TEXT;`);
    console.log('✅ Added numero_controle_pncp to procurement_notices');

    const res = await pool.query(
      `SELECT column_name, data_type 
       FROM information_schema.columns 
       WHERE table_name = 'procurement_notices'
       ORDER BY column_name;`
    );
    console.log('procurement_notices columns:', res.rows.map(r => r.column_name));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

fix();
