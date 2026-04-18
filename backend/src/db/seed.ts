import bcrypt from 'bcryptjs';
import { pool } from './index';

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── Super admin (you — the CEO) ───────────────────────────────────────────
    const superHash = await bcrypt.hash('admin123', 10);
    await client.query(`
      INSERT INTO users (email, password_hash, name, role)
      VALUES ($1, $2, $3, 'super_admin')
      ON CONFLICT (email) DO NOTHING
    `, ['admin@digygocrm.com', superHash, 'DigyGo Admin']);

    // ── Demo tenant (a sample business) ──────────────────────────────────────
    const tenantRes = await client.query(`
      INSERT INTO tenants (name, email, plan)
      VALUES ($1, $2, 'pro')
      ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `, ['Saral Bakery', 'saral@demo.com']);
    const tenantId = tenantRes.rows[0].id;

    // Tenant admin
    const tenantHash = await bcrypt.hash('demo123', 10);
    await client.query(`
      INSERT INTO users (tenant_id, email, password_hash, name, role)
      VALUES ($1, $2, $3, $4, 'admin')
      ON CONFLICT (email) DO NOTHING
    `, [tenantId, 'saral@demo.com', tenantHash, 'Saral Bakery Admin']);

    // Company settings
    await client.query(`
      INSERT INTO company_settings (tenant_id, legal_name, industry, timezone, currency)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (tenant_id) DO NOTHING
    `, [tenantId, 'Saral Bakery Pvt. Ltd.', 'Food & Beverage', 'Asia/Kolkata', 'INR']);

    // Pipeline
    const pipelineRes = await client.query(`
      INSERT INTO pipelines (tenant_id, name) VALUES ($1, 'Sales Pipeline') RETURNING id
    `, [tenantId]);
    const pipelineId = pipelineRes.rows[0].id;

    // Stages
    const stages = ['New Lead', 'Contacted', 'Qualified', 'Proposal Sent', 'Won', 'Lost'];
    const stageIds: string[] = [];
    for (let i = 0; i < stages.length; i++) {
      const r = await client.query(`
        INSERT INTO pipeline_stages (tenant_id, pipeline_id, name, stage_order)
        VALUES ($1, $2, $3, $4) RETURNING id
      `, [tenantId, pipelineId, stages[i], i]);
      stageIds.push(r.rows[0].id);
    }

    // Sample leads
    const leadData = [
      { name: 'Aarav Sharma', email: 'aarav@example.com', phone: '+91 98765 43210', source: 'Meta Forms', stage: 0 },
      { name: 'Priya Nair', email: 'priya.nair@gmail.com', phone: '+91 87654 32109', source: 'Website', stage: 1 },
      { name: 'Rahul Mehta', email: 'rahulmehta@outlook.com', phone: '+91 76543 21098', source: 'Referral', stage: 2 },
      { name: 'Sunita Reddy', email: 'sunita.r@yahoo.com', phone: '+91 65432 10987', source: 'Cold Call', stage: 3 },
      { name: 'Kiran Patel', email: 'kiran.patel@work.com', phone: '+91 54321 09876', source: 'Website', stage: 4 },
    ];

    for (const lead of leadData) {
      await client.query(`
        INSERT INTO leads (tenant_id, name, email, phone, source, pipeline_id, stage_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [tenantId, lead.name, lead.email, lead.phone, lead.source, pipelineId, stageIds[lead.stage]]);
    }

    // Sample notification
    await client.query(`
      INSERT INTO notifications (tenant_id, title, message, type)
      VALUES ($1, $2, $3, $4)
    `, [tenantId, 'Welcome to DigyGo CRM!', 'Your workspace is ready. Start adding leads.', 'info']);

    await client.query('COMMIT');
    console.log('✅  Seed completed');
    console.log('');
    console.log('   Super Admin → admin@digygocrm.com  / admin123');
    console.log('   Demo Tenant → saral@demo.com       / demo123');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌  Seed failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
