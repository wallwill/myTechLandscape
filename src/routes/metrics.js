'use strict';
/**
 * Metrics & Tags Route
 * Spec: specs/metrics.md
 */

const express = require('express');
const { randomUUID } = require('crypto');
const db = require('../db/index');
const { requireRole } = require('../middleware/rbac');
const { requireTenantAccess } = require('../middleware/tenant');

const router = express.Router();

// GET /api/metrics/definitions
router.get('/definitions', requireTenantAccess, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM metric_definitions WHERE tenant_id=$1 ORDER BY is_builtin DESC, label`,
      [req.tenant.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/metrics/definitions
router.post('/definitions', requireRole('tenant_admin'), async (req, res) => {
  const { key, label, type, enum_values, required, description } = req.body;
  if (!key || !label || !type) return res.status(400).json({ error: 'key, label, and type are required' });

  const tenantId = req.tenant.id;

  try {
    const existing = await db.query(
      `SELECT id FROM metric_definitions WHERE tenant_id=$1 AND key=$2`, [tenantId, key]
    );
    if (existing.rows[0]) return res.status(409).json({ error: 'metric key already exists for tenant' });

    const id = randomUUID();
    await db.query(
      `INSERT INTO metric_definitions (id, tenant_id, key, label, type, enum_values, required, description)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, tenantId, key, label, type, enum_values ? JSON.stringify(enum_values) : null, required ? 1 : 0, description||null]
    );

    const result = await db.query(`SELECT * FROM metric_definitions WHERE id=$1`, [id]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'metric key already exists for tenant' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/technologies/:id/metrics
router.get('/technologies/:id/metrics', requireTenantAccess, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT metric_key, metric_value FROM technology_metrics WHERE technology_id=$1 AND tenant_id=$2`,
      [req.params.id, req.tenant.id]
    );
    res.json(Object.fromEntries(result.rows.map(r => [r.metric_key, r.metric_value])));
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/technologies/:id/metrics
router.put('/technologies/:id/metrics', requireRole('technology_owner', 'tco', 'tenant_admin'), async (req, res) => {
  const { metrics } = req.body;
  if (!metrics || typeof metrics !== 'object') return res.status(400).json({ error: 'metrics object is required' });

  const tenantId = req.tenant.id;
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    for (const [key, value] of Object.entries(metrics)) {
      await client.query(
        `INSERT INTO technology_metrics (id, technology_id, tenant_id, metric_key, metric_value, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT(technology_id, metric_key) DO UPDATE SET metric_value=EXCLUDED.metric_value, updated_by=EXCLUDED.updated_by, updated_at=EXTRACT(EPOCH FROM NOW())::BIGINT`,
        [randomUUID(), req.params.id, tenantId, key, String(value), req.session.userId]
      );
    }

    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// GET /api/technologies/:id/tags
router.get('/technologies/:id/tags', requireTenantAccess, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM technology_tags WHERE technology_id=$1 AND tenant_id=$2`,
      [req.params.id, req.tenant.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/technologies/:id/tags
router.post('/technologies/:id/tags', requireTenantAccess, async (req, res) => {
  const { tag, value } = req.body;
  if (!tag) return res.status(400).json({ error: 'tag is required' });

  try {
    const id = randomUUID();
    await db.query(
      `INSERT INTO technology_tags (id, technology_id, tenant_id, tag, value, created_by) VALUES ($1,$2,$3,$4,$5,$6)`,
      [id, req.params.id, req.tenant.id, tag, value||null, req.session.userId]
    );
    const result = await db.query(`SELECT * FROM technology_tags WHERE id=$1`, [id]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Tag already exists for this technology' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/technologies/:id/tags/:tag
router.delete('/technologies/:id/tags/:tag', requireTenantAccess, async (req, res) => {
  try {
    await db.query(
      `DELETE FROM technology_tags WHERE technology_id=$1 AND tenant_id=$2 AND tag=$3`,
      [req.params.id, req.tenant.id, req.params.tag]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
