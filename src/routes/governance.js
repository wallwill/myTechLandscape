'use strict';

const express = require('express');
const db = require('../db/index');
const { requireRole } = require('../middleware/rbac');
const { auditLog } = require('./audit');

const router = express.Router();

function normalizeCapabilityAssignmentRows(rows, userField) {
  const byCapability = new Map();

  rows.forEach(row => {
    if (!byCapability.has(row.capability_id)) {
      byCapability.set(row.capability_id, {
        capability_id: row.capability_id,
        capability_name: row.capability_name,
        parent_id: row.parent_id,
        users: [],
      });
    }

    if (row[userField]) {
      byCapability.get(row.capability_id).users.push({
        id: row[userField],
        username: row.username,
        display_name: row.display_name,
        email: row.email,
        role: row.role,
        assigned_at: row.assigned_at,
      });
    }
  });

  return Array.from(byCapability.values()).sort((a, b) => a.capability_name.localeCompare(b.capability_name));
}

router.get('/capability-owners', requireRole('tenant_admin', 'tco'), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT c.id AS capability_id, c.name AS capability_name, c.parent_id,
              co.user_id, co.assigned_at,
              u.username, u.display_name, u.email, u.role
       FROM capabilities c
       LEFT JOIN capability_ownership co
         ON co.capability_id = c.id
        AND co.tenant_id = c.tenant_id
       LEFT JOIN users u
         ON u.id = co.user_id
       WHERE c.tenant_id = $1 AND c.is_active = 1
       ORDER BY c.name, u.username`,
      [req.tenant.id]
    );

    res.json(normalizeCapabilityAssignmentRows(result.rows, 'user_id'));
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/capability-owners', requireRole('tenant_admin'), async (req, res) => {
  const { capability_id, user_id } = req.body;
  if (!capability_id || !user_id) return res.status(400).json({ error: 'capability_id and user_id are required' });

  try {
    const capabilityResult = await db.query(
      `SELECT * FROM capabilities WHERE id = $1 AND tenant_id = $2 AND is_active = 1`,
      [capability_id, req.tenant.id]
    );
    if (!capabilityResult.rows[0]) return res.status(404).json({ error: 'Capability not found' });

    const userResult = await db.query(
      `SELECT * FROM users WHERE id = $1 AND tenant_id = $2 AND is_active = 1`,
      [user_id, req.tenant.id]
    );
    if (!userResult.rows[0]) return res.status(404).json({ error: 'User not found' });

    await db.query(
      `INSERT INTO capability_ownership (capability_id, user_id, tenant_id)
       VALUES ($1,$2,$3)
       ON CONFLICT DO NOTHING`,
      [capability_id, user_id, req.tenant.id]
    );

    await db.query(
      `UPDATE capabilities
          SET owner_user_id = COALESCE(owner_user_id, $1),
              updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
        WHERE id = $2 AND tenant_id = $3`,
      [user_id, capability_id, req.tenant.id]
    );

    await auditLog(req, 'capability_owner', `${capability_id}:${user_id}`, 'assign', null, {
      capability_id,
      user_id,
    });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/capability-owners/:capabilityId/:userId', requireRole('tenant_admin'), async (req, res) => {
  const { capabilityId, userId } = req.params;

  try {
    await db.query(
      `DELETE FROM capability_ownership
       WHERE capability_id = $1 AND user_id = $2 AND tenant_id = $3`,
      [capabilityId, userId, req.tenant.id]
    );

    const remainingOwners = await db.query(
      `SELECT user_id FROM capability_ownership
       WHERE capability_id = $1 AND tenant_id = $2
       ORDER BY assigned_at ASC
       LIMIT 1`,
      [capabilityId, req.tenant.id]
    );

    await db.query(
      `UPDATE capabilities
          SET owner_user_id = $1,
              updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
        WHERE id = $2 AND tenant_id = $3`,
      [remainingOwners.rows[0]?.user_id || null, capabilityId, req.tenant.id]
    );

    await auditLog(req, 'capability_owner', `${capabilityId}:${userId}`, 'remove', {
      capability_id: capabilityId,
      user_id: userId,
    }, null);

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/capability-evaluators', requireRole('tenant_admin', 'tco'), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT c.id AS capability_id, c.name AS capability_name, c.parent_id,
              ce.user_id, ce.assigned_at,
              u.username, u.display_name, u.email, u.role
       FROM capabilities c
       LEFT JOIN capability_evaluators ce
         ON ce.capability_id = c.id
        AND ce.tenant_id = c.tenant_id
       LEFT JOIN users u
         ON u.id = ce.user_id
       WHERE c.tenant_id = $1 AND c.is_active = 1
       ORDER BY c.name, u.username`,
      [req.tenant.id]
    );

    res.json(normalizeCapabilityAssignmentRows(result.rows, 'user_id'));
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/capability-evaluators', requireRole('tenant_admin'), async (req, res) => {
  const { capability_id, user_id } = req.body;
  if (!capability_id || !user_id) return res.status(400).json({ error: 'capability_id and user_id are required' });

  try {
    const capabilityResult = await db.query(
      `SELECT id FROM capabilities WHERE id = $1 AND tenant_id = $2 AND is_active = 1`,
      [capability_id, req.tenant.id]
    );
    if (!capabilityResult.rows[0]) return res.status(404).json({ error: 'Capability not found' });

    const userResult = await db.query(
      `SELECT id FROM users WHERE id = $1 AND tenant_id = $2 AND is_active = 1`,
      [user_id, req.tenant.id]
    );
    if (!userResult.rows[0]) return res.status(404).json({ error: 'User not found' });

    await db.query(
      `INSERT INTO capability_evaluators (capability_id, user_id, tenant_id)
       VALUES ($1,$2,$3)
       ON CONFLICT DO NOTHING`,
      [capability_id, user_id, req.tenant.id]
    );

    await auditLog(req, 'capability_evaluator', `${capability_id}:${user_id}`, 'assign', null, {
      capability_id,
      user_id,
    });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/capability-evaluators/:capabilityId/:userId', requireRole('tenant_admin'), async (req, res) => {
  const { capabilityId, userId } = req.params;

  try {
    await db.query(
      `DELETE FROM capability_evaluators
       WHERE capability_id = $1 AND user_id = $2 AND tenant_id = $3`,
      [capabilityId, userId, req.tenant.id]
    );

    await auditLog(req, 'capability_evaluator', `${capabilityId}:${userId}`, 'remove', {
      capability_id: capabilityId,
      user_id: userId,
    }, null);

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
