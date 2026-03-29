'use strict';
/**
 * LOB Exceptions Route
 * Spec: specs/exceptions.md
 */

const express = require('express');
const { randomUUID } = require('crypto');
const db = require('../db/index');
const { requireRole } = require('../middleware/rbac');
const { requireTenantAccess } = require('../middleware/tenant');

const router = express.Router({ mergeParams: true });

// GET /api/technologies/:id/exceptions
router.get('/', requireTenantAccess, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT le.*, u.username as approved_by_username
       FROM lob_exceptions le
       LEFT JOIN users u ON u.id = le.approved_by
       WHERE le.technology_id=$1 AND le.tenant_id=$2
       ORDER BY le.created_at DESC`,
      [req.params.id, req.tenant.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/technologies/:id/exceptions
router.post('/', requireRole('tco', 'tenant_admin', 'lob_admin'), async (req, res) => {
  const { lob, exception_type, justification, conditions, expires_at, migration_target_id } = req.body;
  if (!lob) return res.status(400).json({ error: 'lob is required' });
  if (!exception_type || !['approved', 'prohibited', 'restricted'].includes(exception_type)) {
    return res.status(400).json({ error: 'exception_type must be: approved, prohibited, or restricted' });
  }
  if (!justification) return res.status(400).json({ error: 'justification is required' });

  try {
    const id = randomUUID();
    await db.query(
      `INSERT INTO lob_exceptions (id, technology_id, tenant_id, lob, exception_type, justification, conditions, expires_at, migration_target_id, approved_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [id, req.params.id, req.tenant.id, lob, exception_type, justification,
       conditions||null, expires_at||null, migration_target_id||null, req.session.userId]
    );

    const result = await db.query(`SELECT * FROM lob_exceptions WHERE id=$1`, [id]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/technologies/:id/exceptions/:exceptionId
router.put('/:exceptionId', requireRole('tco', 'tenant_admin', 'lob_admin'), async (req, res) => {
  const { exception_type, conditions, expires_at, justification } = req.body;
  try {
    await db.query(
      `UPDATE lob_exceptions SET exception_type=COALESCE($1,exception_type), conditions=COALESCE($2,conditions),
       expires_at=COALESCE($3,expires_at), justification=COALESCE($4,justification),
       updated_at=EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id=$5 AND tenant_id=$6`,
      [exception_type||null, conditions||null, expires_at||null, justification||null,
       req.params.exceptionId, req.tenant.id]
    );

    const result = await db.query(`SELECT * FROM lob_exceptions WHERE id=$1`, [req.params.exceptionId]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/technologies/:id/exceptions/:exceptionId
router.delete('/:exceptionId', requireRole('tco', 'tenant_admin'), async (req, res) => {
  try {
    await db.query(
      `UPDATE lob_exceptions SET is_active=0, updated_at=EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id=$1 AND tenant_id=$2`,
      [req.params.exceptionId, req.tenant.id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
