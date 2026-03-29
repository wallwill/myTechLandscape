'use strict';
/**
 * Tenants Route
 * Spec: specs/tenants.md
 */

const express = require('express');
const { randomUUID } = require('crypto');
const db = require('../db/index');
const { requireRole } = require('../middleware/rbac');
const { requireTenantAccess } = require('../middleware/tenant');

const router = express.Router();

// GET /api/tenants — Platform Admin only
router.get('/', requireRole('platform_admin'), async (req, res) => {
  try {
    const result = await db.query(`SELECT * FROM tenants ORDER BY name`);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/tenants — Platform Admin only
router.post('/', requireRole('platform_admin'), async (req, res) => {
  const { name, slug, config } = req.body;
  if (!name || !slug) return res.status(400).json({ error: 'name and slug are required' });

  try {
    const existing = await db.query(`SELECT id FROM tenants WHERE slug = $1`, [slug]);
    if (existing.rows[0]) return res.status(409).json({ error: 'slug already exists' });

    const id = randomUUID();
    await db.query(
      `INSERT INTO tenants (id, name, slug, config) VALUES ($1, $2, $3, $4)`,
      [id, name, slug, JSON.stringify(config || {})]
    );

    const tenantResult = await db.query(`SELECT * FROM tenants WHERE id = $1`, [id]);
    res.status(201).json(tenantResult.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'slug already exists' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/tenants/:tenantId
router.get('/:tenantId', requireTenantAccess, async (req, res) => {
  try {
    const result = await db.query(`SELECT * FROM tenants WHERE id = $1`, [req.params.tenantId]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Tenant not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/tenants/:tenantId — Tenant Admin
router.put('/:tenantId', requireRole('tenant_admin', 'platform_admin'), async (req, res) => {
  const { name, config } = req.body;
  try {
    await db.query(
      `UPDATE tenants SET name = COALESCE($1, name), config = COALESCE($2, config),
       updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = $3`,
      [name || null, config ? JSON.stringify(config) : null, req.params.tenantId]
    );
    const result = await db.query(`SELECT * FROM tenants WHERE id = $1`, [req.params.tenantId]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/tenants/:tenantId — Platform Admin (soft delete)
router.delete('/:tenantId', requireRole('platform_admin'), async (req, res) => {
  try {
    await db.query(
      `UPDATE tenants SET is_active = 0, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = $1`,
      [req.params.tenantId]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
