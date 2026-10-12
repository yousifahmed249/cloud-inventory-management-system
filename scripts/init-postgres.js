const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('DATABASE_URL is required. Example: postgresql://user:pass@host:5432/inventory_db');
  process.exit(1);
}

const pool = new Pool({ connectionString: databaseUrl });

async function initializeDatabase() {
  const schema = fs.readFileSync(schemaPath, 'utf8');
  await pool.query(schema);

  const adminEmail = 'admin@inventory.local';
  const adminPassword = bcrypt.hashSync('admin123', 10);

  const existingUser = await pool.query(
    'SELECT id FROM users WHERE email = $1',
    [adminEmail]
  );

  if (existingUser.rowCount === 0) {
    await pool.query(
      `INSERT INTO users (id, name, email, password, role)
       VALUES ($1, $2, $3, $4, $5)`,
      ['admin-1', 'Administrator', adminEmail, adminPassword, 'admin']
    );
  }

  console.log('PostgreSQL schema initialized successfully.');
  console.log(`Default admin: ${adminEmail} / admin123`);
}

initializeDatabase()
  .then(async () => {
    await pool.end();
  })
  .catch((error) => {
    console.error('PostgreSQL initialization failed:', error.message);
    process.exit(1);
  });
