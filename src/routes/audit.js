'use strict';
/**
 * Audit Route
 * Spec: specs/audit.md
 */

const express = require('express');
const { randomUUID } = require('crypto');
const db = require('../db/index');
const { requireTenantAccess } = require('../middleware/tenant');

const router = express.Router();

// GET /api/audit
router.get('/', requireTenantAccess, async (req, res) => {
  const { entity_type, entity_id, user_id, action, from, to, page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;

  let where = `tenant_id = $1`;
  const params = [req.tenant.id];
  let idx = 2;

  if (entity_type) { where += ` AND entity_type = $${idx++}`; params.push(entity_type); }
  if (entity_id)   { where += ` AND entity_id = $${idx++}`;   params.push(entity_id); }
  if (user_id)     { where += ` AND user_id = $${idx++}`;     params.push(user_id); }
  if (action)      { where += ` AND action = $${idx++}`;      params.push(action); }
  if (from)        { where += ` AND created_at >= $${idx++}`; params.push(Number(from)); }
  if (to)          { where += ` AND created_at <= $${idx++}`; params.push(Number(to)); }

  try {
    const totalResult = await db.query(`SELECT COUNT(*) as n FROM audit_log WHERE ${where}`, params);
    const total = Number(totalResult.rows[0].n);

    const itemsResult = await db.query(
      `SELECT * FROM audit_log WHERE ${where} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, Number(limit), offset]
    );

    res.json({ total, items: itemsResult.rows });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/audit/entity/:entityType/:entityId
router.get('/entity/:entityType/:entityId', requireTenantAccess, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM audit_log WHERE tenant_id=$1 AND entity_type=$2 AND entity_id=$3 ORDER BY created_at DESC`,
      [req.tenant.id, req.params.entityType, req.params.entityId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * auditLog — utility for route handlers to write an audit entry
 */
async function auditLog(req, entityType, entityId, action, oldValue = null, newValue = null) {
  try {
    await db.query(
      `INSERT INTO audit_log (id, tenant_id, entity_type, entity_id, action, user_id, username, old_value, new_value, ip_address, user_agent)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        randomUUID(),
        req.tenant?.id || null,
        entityType,
        entityId,
        action,
        req.session?.userId || null,
        req.session?.username || null,
        oldValue ? JSON.stringify(oldValue) : null,
        newValue ? JSON.stringify(newValue) : null,
        req.ip || null,
        req.headers['user-agent'] || null,
      ]
    );
  } catch (err) {
    // Audit failures should not break the main request
    console.error('Audit log error:', err.message);
  }
}

module.exports = router;
module.exports.auditLog = auditLog;
