const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
require('dotenv').config({ path: __dirname + '/../.env' });

async function seed() {
  const pool = new Pool({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
  try {
    console.log('Connecting to database...');
    
    // 1. Create or get tenant
    const tenantRes = await pool.query(
      `INSERT INTO tenants (id, name, slug, active, created_at, updated_at)
       VALUES (gen_random_uuid(), 'Expertise Matriz', 'expertise-matriz', true, NOW(), NOW())
       ON CONFLICT (slug) DO UPDATE SET updated_at = NOW()
       RETURNING id;`
    );
    const tenantId = tenantRes.rows[0].id;
    console.log('Tenant ID:', tenantId);

    // 2. Hash password
    const hashedPassword = await bcrypt.hash('Password123!', 10);

    // 3. Create or update user
    const email = 'admin@expertise.com.br';
    const emailNormalized = email.toLowerCase().trim();

    const userRes = await pool.query(
      `INSERT INTO users (
        id, tenant_id, email, email_normalized, nome, telefone, plano, plan_type,
        cnpjs_registered, monthly_analyses_used, monthly_proposals_used,
        email_verificado, password_hash, aceite_lgpd, role, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, 'Raynara Kácia', '(11) 99999-8888', 'master', 'MASTER'::"PlanType",
        1, 0, 0,
        true, $4, true, 'fornecedor', NOW(), NOW()
      )
      ON CONFLICT (email_normalized) DO UPDATE SET
        password_hash = $4,
        plan_type = 'MASTER'::"PlanType",
        plano = 'master',
        updated_at = NOW()
      RETURNING id, tenant_id, email, nome, role, plan_type;`,
      [tenantId, email, emailNormalized, hashedPassword]
    );
    const user = userRes.rows[0];
    console.log('User created/updated:', user);

    // 4. Create or update company
    const cnpj = '12345678000195';
    const companyRes = await pool.query(
      `INSERT INTO companies (
        id, tenant_id, user_id, cnpj, razao_social, nome_fantasia,
        cnae_principal, municipio, uf, status, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, 'EXPERTISE ENGENHARIA E LICITACOES LTDA', 'EXPERTISE TECH',
        '6201-5/01', 'São Paulo', 'SP', 'ATIVA', NOW(), NOW()
      )
      ON CONFLICT (tenant_id, cnpj) DO UPDATE SET
        user_id = $2,
        updated_at = NOW()
      RETURNING id, razao_social, cnpj;`,
      [tenantId, user.id, cnpj]
    );
    const company = companyRes.rows[0];
    console.log('Company created/updated:', company);

    // 5. Create Subscription with MASTER plan
    await pool.query(
      `INSERT INTO subscriptions (
        id, user_id, plan_id, plan_type, status, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), $1, 'plan_master', 'MASTER'::"PlanType", 'active', NOW(), NOW()
      )
      ON CONFLICT DO NOTHING;`,
      [user.id]
    ).catch(e => console.log('Subscription note:', e.message));

    // 6. Generate JWT Auth Tokens
    const jwtSecret = process.env.JWT_SECRET || 'expertise-licitatoria-secret-key-production-ready-2026';
    const publicUser = {
      id: user.id,
      tenant_id: user.tenant_id,
      email: user.email,
      nome: user.nome,
      telefone: '(11) 99999-8888',
      plano: 'master',
      role: user.role,
      email_verificado: true,
      plan_type: 'MASTER'
    };

    const accessToken = jwt.sign(
      { ...publicUser, token_type: 'access' },
      jwtSecret,
      { expiresIn: '30d', jwtid: crypto.randomUUID() }
    );
    const refreshToken = jwt.sign(
      { ...publicUser, token_type: 'refresh' },
      jwtSecret,
      { expiresIn: '60d', jwtid: crypto.randomUUID() }
    );

    console.log('\n--- AUTH TEST DATA ---');
    console.log('Email: admin@expertise.com.br');
    console.log('Password: Password123!');
    console.log('Access Token:\n' + accessToken);
    console.log('\nPublic User Object:\n' + JSON.stringify(publicUser));

  } catch (err) {
    console.error('Error during seeding:', err);
  } finally {
    await pool.end();
  }
}

seed();
