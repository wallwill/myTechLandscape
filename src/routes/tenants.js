'use strict';
/**
 * Tenants Route
 * Spec: specs/tenants.md
 */

const express = require('express');
const { randomUUID } = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../db/index');
const { requireRole } = require('../middleware/rbac');
const { requireTenantAccess } = require('../middleware/tenant');

const router = express.Router();

// GET /api/tenants — Platform Admin only
router.get('/', requireRole('platform_admin'), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT t.*,
              COUNT(u.id)::INTEGER AS admin_count
       FROM tenants t
       LEFT JOIN users u
         ON u.tenant_id = t.id
        AND u.role = 'tenant_admin'
        AND u.is_active = 1
       GROUP BY t.id
       ORDER BY t.name`
    );
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

// GET /api/tenants/admin-users — Platform Admin only
router.get('/admin-users', requireRole('platform_admin'), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT u.id, u.tenant_id, u.username, u.email, u.display_name, u.role, u.is_active, u.created_at,
              t.name AS tenant_name, t.slug AS tenant_slug
       FROM users u
       JOIN tenants t ON t.id = u.tenant_id
       WHERE u.role IN ('tenant_admin', 'platform_admin')
       ORDER BY t.name, u.username`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/tenants/admin-users — Platform Admin only
router.post('/admin-users', requireRole('platform_admin'), async (req, res) => {
  const { tenant_id, username, password, email, display_name, role } = req.body;
  const normalizedRole = role || 'tenant_admin';

  if (!tenant_id || !username || !password) {
    return res.status(400).json({ error: 'tenant_id, username, and password are required' });
  }
  if (!['tenant_admin', 'platform_admin'].includes(normalizedRole)) {
    return res.status(400).json({ error: 'role must be tenant_admin or platform_admin' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'password must be at least 6 characters' });
  }

  try {
    const tenantResult = await db.query(`SELECT id FROM tenants WHERE id = $1 AND is_active = 1`, [tenant_id]);
    if (!tenantResult.rows[0]) return res.status(404).json({ error: 'Tenant not found' });

    const existing = await db.query(
      `SELECT id FROM users WHERE tenant_id = $1 AND username = $2`,
      [tenant_id, username]
    );
    if (existing.rows[0]) return res.status(409).json({ error: 'username already exists in this tenant' });

    const id = randomUUID();
    const password_hash = bcrypt.hashSync(password, 10);
    await db.query(
      `INSERT INTO users (id, tenant_id, username, email, display_name, password_hash, role)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, tenant_id, username, email || null, display_name || null, password_hash, normalizedRole]
    );

    const result = await db.query(
      `SELECT u.id, u.tenant_id, u.username, u.email, u.display_name, u.role, u.is_active, u.created_at,
              t.name AS tenant_name, t.slug AS tenant_slug
       FROM users u
       JOIN tenants t ON t.id = u.tenant_id
       WHERE u.id = $1`,
      [id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'username already exists in this tenant' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/tenants/admin-users/:id — Platform Admin only
router.put('/admin-users/:id', requireRole('platform_admin'), async (req, res) => {
  const { tenant_id, username, email, display_name, role, password } = req.body;
  if (!tenant_id || !username) return res.status(400).json({ error: 'tenant_id and username are required' });
  if (role && !['tenant_admin', 'platform_admin'].includes(role)) {
    return res.status(400).json({ error: 'role must be tenant_admin or platform_admin' });
  }
  if (password && password.length < 6) {
    return res.status(400).json({ error: 'password must be at least 6 characters' });
  }

  try {
    const tenantResult = await db.query(`SELECT id FROM tenants WHERE id = $1 AND is_active = 1`, [tenant_id]);
    if (!tenantResult.rows[0]) return res.status(404).json({ error: 'Tenant not found' });

    const existing = await db.query(
      `SELECT id FROM users WHERE tenant_id = $1 AND username = $2 AND id <> $3`,
      [tenant_id, username, req.params.id]
    );
    if (existing.rows[0]) return res.status(409).json({ error: 'username already exists in this tenant' });

    await db.query(
      `UPDATE users
          SET tenant_id = $1,
              username = $2,
              email = $3,
              display_name = $4,
              role = COALESCE($5, role),
              password_hash = COALESCE($6, password_hash)
        WHERE id = $7`,
      [
        tenant_id,
        username,
        email || null,
        display_name || null,
        role || null,
        password ? bcrypt.hashSync(password, 10) : null,
        req.params.id,
      ]
    );

    const result = await db.query(
      `SELECT u.id, u.tenant_id, u.username, u.email, u.display_name, u.role, u.is_active, u.created_at,
              t.name AS tenant_name, t.slug AS tenant_slug
       FROM users u
       JOIN tenants t ON t.id = u.tenant_id
       WHERE u.id = $1`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Admin user not found' });
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'username already exists in this tenant' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/tenants/admin-users/:id — Platform Admin only
router.delete('/admin-users/:id', requireRole('platform_admin'), async (req, res) => {
  if (req.params.id === req.session.userId) {
    return res.status(400).json({ error: 'Cannot remove your own account' });
  }

  try {
    await db.query(`UPDATE users SET is_active = 0 WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
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
  const { name, slug, config } = req.body;
  try {
    if (req.session.role === 'tenant_admin' && req.params.tenantId !== req.tenant.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await db.query(
      `UPDATE tenants
          SET name = COALESCE($1, name),
              slug = COALESCE($2, slug),
              config = COALESCE($3, config),
              updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
        WHERE id = $4`,
      [
        name || null,
        req.session.role === 'platform_admin' ? (slug || null) : null,
        config ? JSON.stringify(config) : null,
        req.params.tenantId,
      ]
    );
    const result = await db.query(`SELECT * FROM tenants WHERE id = $1`, [req.params.tenantId]);
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'slug already exists' });
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
