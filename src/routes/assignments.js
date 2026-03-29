'use strict';

const express = require('express');
const { randomUUID } = require('crypto');
const db = require('../db/index');
const { requireAuth } = require('../middleware/auth');
const { auditLog } = require('./audit');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT a.*, u.username AS updated_by_username
       FROM assignments a
       LEFT JOIN users u ON u.id = a.updated_by
       WHERE a.tenant_id = $1
       ORDER BY a.project_name NULLS LAST, a.project_id`,
      [req.tenant.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', requireAuth, async (req, res) => {
  const { projectId, projectName, stage, owner, notes } = req.body;
  if (!projectId) return res.status(400).json({ error: 'projectId required' });

  try {
    const existingResult = await db.query(
      `SELECT * FROM assignments WHERE tenant_id = $1 AND project_id = $2`,
      [req.tenant.id, projectId]
    );
    const existing = existingResult.rows[0] || null;

    if (!stage) {
      await db.query(
        `DELETE FROM assignments WHERE tenant_id = $1 AND project_id = $2`,
        [req.tenant.id, projectId]
      );

      if (existing) {
        await auditLog(req, 'assignment', projectId, 'remove', existing, null);
      }

      return res.json({ ok: true });
    }

    const assignment = {
      tenant_id: req.tenant.id,
      project_id: projectId,
      project_name: projectName || projectId,
      stage,
      owner: owner || null,
      notes: notes || null,
      updated_by: req.session.userId,
    };

    await db.query(
      `INSERT INTO assignments (id, tenant_id, project_id, project_name, stage, owner, notes, updated_at, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,EXTRACT(EPOCH FROM NOW())::BIGINT,$8)
       ON CONFLICT (tenant_id, project_id) DO UPDATE SET
         project_name = EXCLUDED.project_name,
         stage = EXCLUDED.stage,
         owner = EXCLUDED.owner,
         notes = EXCLUDED.notes,
         updated_at = EXCLUDED.updated_at,
         updated_by = EXCLUDED.updated_by`,
      [
        existing?.id || randomUUID(),
        assignment.tenant_id,
        assignment.project_id,
        assignment.project_name,
        assignment.stage,
        assignment.owner,
        assignment.notes,
        assignment.updated_by,
      ]
    );

    await auditLog(
      req,
      'assignment',
      projectId,
      existing ? 'update' : 'assign',
      existing,
      assignment
    );

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
