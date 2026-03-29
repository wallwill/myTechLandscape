'use strict';
/**
 * Operating Model Route — Users & Roles
 * Spec: specs/operating-model.md
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');
const db = require('../db/index');
const { requireRole } = require('../middleware/rbac');
const { requireTenantAccess } = require('../middleware/tenant');

const router = express.Router();

// GET /api/users
router.get('/', requireRole('tenant_admin'), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, username, email, display_name, role, lob, is_active, created_at
       FROM users WHERE tenant_id = $1 ORDER BY username`,
      [req.tenant.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/users
router.post('/', requireRole('tenant_admin'), async (req, res) => {
  const { username, email, password, role, capability_id, lob } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username and password are required' });
  if (password.length < 6) return res.status(400).json({ error: 'password must be at least 6 characters' });

  const tenantId = req.tenant.id;

  try {
    const existing = await db.query(
      `SELECT id FROM users WHERE tenant_id=$1 AND username=$2`, [tenantId, username]
    );
    if (existing.rows[0]) return res.status(409).json({ error: 'username already exists in this tenant' });

    const id = randomUUID();
    const hash = bcrypt.hashSync(password, 10);
    await db.query(
      `INSERT INTO users (id, tenant_id, username, email, password_hash, role, lob) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id, tenantId, username, email||null, hash, role||'member', lob||null]
    );

    if (capability_id && role === 'tco') {
      await db.query(
        `INSERT INTO capability_ownership (capability_id, user_id, tenant_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
        [capability_id, id, tenantId]
      );
    }

    const userResult = await db.query(
      `SELECT id, username, email, display_name, role, lob FROM users WHERE id=$1`, [id]
    );
    res.status(201).json(userResult.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'username already exists in this tenant' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/users/:id/role
router.put('/:id/role', requireRole('tenant_admin'), async (req, res) => {
  const { role } = req.body;
  if (!role) return res.status(400).json({ error: 'role is required' });

  try {
    await db.query(
      `UPDATE users SET role=$1 WHERE id=$2 AND tenant_id=$3`,
      [role, req.params.id, req.tenant.id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/users/:id
router.delete('/:id', requireRole('tenant_admin'), async (req, res) => {
  if (req.params.id === req.session.userId) {
    return res.status(400).json({ error: 'Cannot remove your own account' });
  }
  try {
    await db.query(
      `UPDATE users SET is_active=0 WHERE id=$1 AND tenant_id=$2`,
      [req.params.id, req.tenant.id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/users/:id/assignments
router.get('/:id/assignments', requireTenantAccess, async (req, res) => {
  try {
    const capsResult = await db.query(
      `SELECT c.* FROM capabilities c
       JOIN capability_ownership co ON co.capability_id = c.id
       WHERE co.user_id=$1 AND co.tenant_id=$2`,
      [req.params.id, req.tenant.id]
    );

    const cardsResult = await db.query(
      `SELECT t.name, t.tech_id, tc.state FROM technologies t
       JOIN technology_cards tc ON tc.technology_id = t.id
       WHERE tc.owner_user_id=$1 AND t.tenant_id=$2`,
      [req.params.id, req.tenant.id]
    );

    res.json({ capabilities: capsResult.rows, technology_cards: cardsResult.rows });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
