'use strict';
/**
 * Technical Capability Model Route
 * Spec: specs/tcm.md
 */

const express = require('express');
const { randomUUID } = require('crypto');
const db = require('../db/index');
const { requireRole } = require('../middleware/rbac');
const { requireTenantAccess } = require('../middleware/tenant');

const router = express.Router();

// GET /api/tcm
router.get('/', requireTenantAccess, async (req, res) => {
  const tenantId = req.tenant.id;
  const flat = req.query.flat === 'true';

  try {
    const result = await db.query(
      `SELECT * FROM capabilities WHERE tenant_id = $1 AND is_active = 1 ORDER BY name`,
      [tenantId]
    );
    const rows = result.rows;

    if (flat) return res.json(rows);

    // Build tree
    const map = {};
    const roots = [];
    rows.forEach(r => { map[r.id] = { ...r, children: [] }; });
    rows.forEach(r => {
      if (r.parent_id && map[r.parent_id]) {
        map[r.parent_id].children.push(map[r.id]);
      } else {
        roots.push(map[r.id]);
      }
    });

    res.json(roots);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/tcm
router.post('/', requireRole('tco', 'tenant_admin'), async (req, res) => {
  const { name, description, parent_id, owner_user_id } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const tenantId = req.tenant.id;
  const id = randomUUID();

  try {
    await db.query(
      `INSERT INTO capabilities (id, tenant_id, name, description, parent_id, owner_user_id) VALUES ($1,$2,$3,$4,$5,$6)`,
      [id, tenantId, name, description || null, parent_id || null, owner_user_id || null]
    );

    const result = await db.query(`SELECT * FROM capabilities WHERE id = $1`, [id]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Capability already exists' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/tcm/:id
router.put('/:id', requireRole('tco', 'tenant_admin'), async (req, res) => {
  const { name, description, owner_user_id } = req.body;
  try {
    await db.query(
      `UPDATE capabilities SET name = COALESCE($1, name), description = COALESCE($2, description),
       owner_user_id = COALESCE($3, owner_user_id), updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
       WHERE id = $4 AND tenant_id = $5`,
      [name || null, description || null, owner_user_id || null, req.params.id, req.tenant.id]
    );
    const result = await db.query(`SELECT * FROM capabilities WHERE id = $1`, [req.params.id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/tcm/:id
router.delete('/:id', requireRole('tenant_admin'), async (req, res) => {
  try {
    const activeResult = await db.query(
      `SELECT COUNT(*) as n FROM technologies WHERE capability_id = $1 AND tenant_id = $2 AND is_active = 1`,
      [req.params.id, req.tenant.id]
    );

    if (Number(activeResult.rows[0].n) > 0) {
      return res.status(409).json({ error: 'Capability has active technologies' });
    }

    await db.query(
      `UPDATE capabilities SET is_active = 0, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = $1 AND tenant_id = $2`,
      [req.params.id, req.tenant.id]
    );

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/tcm/:id/technologies
router.get('/:id/technologies', requireTenantAccess, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT t.*, tc.state FROM technologies t
       JOIN technology_cards tc ON tc.technology_id = t.id
       WHERE t.capability_id = $1 AND t.tenant_id = $2 AND t.is_active = 1`,
      [req.params.id, req.tenant.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
