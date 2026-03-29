'use strict';
/**
 * Patterns Route
 * Spec: specs/patterns.md
 */

const express = require('express');
const { randomUUID } = require('crypto');
const db = require('../db/index');
const { requireRole } = require('../middleware/rbac');
const { requireTenantAccess } = require('../middleware/tenant');

const router = express.Router({ mergeParams: true });

const VALID_TYPES = ['approved_pattern', 'anti_pattern', 'genai_prompt', 'sdk_constraint', 'code_sample'];

// GET /api/technologies/:id/patterns
router.get('/', requireTenantAccess, async (req, res) => {
  const { type } = req.query;
  let query = `SELECT * FROM patterns WHERE technology_id=$1 AND tenant_id=$2`;
  const params = [req.params.id, req.tenant.id];

  if (type && VALID_TYPES.includes(type)) {
    query += ` AND type=$3`;
    params.push(type);
  }

  query += ` ORDER BY type, created_at`;

  try {
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/technologies/:id/patterns
router.post('/', requireRole('technology_owner', 'tco'), async (req, res) => {
  const { type, title, content, code_sample, language, tags, source_url } = req.body;
  if (!type || !VALID_TYPES.includes(type)) return res.status(400).json({ error: `type must be one of: ${VALID_TYPES.join(', ')}` });
  if (!title) return res.status(400).json({ error: 'title is required' });
  if (!content) return res.status(400).json({ error: 'content is required' });

  try {
    const id = randomUUID();
    await db.query(
      `INSERT INTO patterns (id, technology_id, tenant_id, type, title, content, code_sample, language, tags, source_url, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [id, req.params.id, req.tenant.id, type, title, content,
       code_sample||null, language||null, tags ? JSON.stringify(tags) : null, source_url||null, req.session.userId]
    );

    const result = await db.query(`SELECT * FROM patterns WHERE id=$1`, [id]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/technologies/:id/patterns/:patternId
router.put('/:patternId', requireRole('technology_owner', 'tco'), async (req, res) => {
  const { title, content, code_sample, language, tags, source_url } = req.body;
  try {
    await db.query(
      `UPDATE patterns SET title=COALESCE($1,title), content=COALESCE($2,content),
       code_sample=COALESCE($3,code_sample), language=COALESCE($4,language),
       tags=COALESCE($5,tags), source_url=COALESCE($6,source_url),
       updated_at=EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id=$7 AND tenant_id=$8`,
      [title||null, content||null, code_sample||null, language||null,
       tags ? JSON.stringify(tags) : null, source_url||null, req.params.patternId, req.tenant.id]
    );

    const result = await db.query(`SELECT * FROM patterns WHERE id=$1`, [req.params.patternId]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/technologies/:id/patterns/:patternId
router.delete('/:patternId', requireRole('technology_owner', 'tco'), async (req, res) => {
  try {
    await db.query(
      `DELETE FROM patterns WHERE id=$1 AND tenant_id=$2`,
      [req.params.patternId, req.tenant.id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
