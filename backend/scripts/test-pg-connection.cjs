require('dotenv').config();
const { Client } = require('pg');

(async () => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    const result = await client.query('SELECT current_database() AS db, current_user AS user');
    console.log(`PG_OK db=${result.rows[0].db} user=${result.rows[0].user}`);
  } catch (error) {
    console.error(`PG_ERRO ${error.code || ''}: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
})();
