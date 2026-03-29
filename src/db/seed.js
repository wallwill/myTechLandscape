'use strict';
const { randomUUID } = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('./index');

const BUILTIN_METRICS = [
  { key: 'security_score',        label: 'Security Score',        type: 'enum',   enum_values: JSON.stringify(['Gold','Silver','Bronze','Unrated']) },
  { key: 'license_type',          label: 'License Type',          type: 'enum',   enum_values: JSON.stringify(['Apache-2.0','MIT','GPL','Proprietary','Other']) },
  { key: 'operational_readiness', label: 'Operational Readiness', type: 'number', enum_values: null },
  { key: 'cost_profile',          label: 'Cost Profile',          type: 'enum',   enum_values: JSON.stringify(['Low (OSS)','Medium','High']) },
  { key: 'cve_count_active',      label: 'Active CVEs',           type: 'number', enum_values: null },
];

async function seed() {
  // Default tenant
  let result = await db.query(`SELECT id FROM tenants WHERE slug = 'default'`);
  let tenant = result.rows[0];
  if (!tenant) {
    const tenantId = randomUUID();
    await db.query(`INSERT INTO tenants (id, name, slug) VALUES ($1, 'Default', 'default')`, [tenantId]);
    tenant = { id: tenantId };
    console.log('Default tenant created — slug: default');
  }

  // Platform admin user
  const adminResult = await db.query(
    `SELECT id FROM users WHERE role = 'platform_admin' AND tenant_id = $1`, [tenant.id]
  );
  if (!adminResult.rows[0]) {
    const hash = bcrypt.hashSync('admin', 10);
    await db.query(
      `INSERT INTO users (id, tenant_id, username, password_hash, role) VALUES ($1, $2, 'admin', $3, 'platform_admin')`,
      [randomUUID(), tenant.id, hash]
    );
    console.log('Default admin created — username: admin  password: admin');
  }

  // Built-in metric definitions
  for (const m of BUILTIN_METRICS) {
    await db.query(
      `INSERT INTO metric_definitions (id, tenant_id, key, label, type, enum_values, is_builtin)
       VALUES ($1, $2, $3, $4, $5, $6, 1)
       ON CONFLICT DO NOTHING`,
      [randomUUID(), tenant.id, m.key, m.label, m.type, m.enum_values]
    );
  }
}

module.exports = seed;
