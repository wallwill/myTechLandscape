'use strict';
/**
 * Lifecycle & Decision Records Route
 * Spec: specs/lifecycle.md
 */

const express = require('express');
const { randomUUID } = require('crypto');
const db = require('../db/index');
const { requireRole } = require('../middleware/rbac');
const { requireTenantAccess } = require('../middleware/tenant');

const router = express.Router({ mergeParams: true });

const VALID_STATES = ['Invest', 'Maintain', 'Tolerate', 'Eliminate', 'Emerging'];

// POST /api/technologies/:id/lifecycle/transition
router.post('/transition', requireRole('tco', 'technology_owner'), async (req, res) => {
  const tenantId = req.tenant.id;
  const techId = req.params.id;
  const { new_state, rationale, sunset_date, review_date, migration_target_id, adr_link, evidence_links } = req.body;

  if (!new_state || !VALID_STATES.includes(new_state)) {
    return res.status(400).json({ error: `new_state must be one of: ${VALID_STATES.join(', ')}` });
  }
  if (!rationale) return res.status(400).json({ error: 'rationale is required' });

  if ((new_state === 'Tolerate' || new_state === 'Eliminate') && !sunset_date) {
    return res.status(400).json({ error: `sunset_date is required for state: ${new_state}` });
  }

  const tenantConfig = JSON.parse(req.tenant.config || '{}');
  if (tenantConfig.require_adr_for_state_change && !adr_link) {
    return res.status(400).json({ error: 'adr_link is required by tenant configuration' });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Check for blocking evaluations
    const blockingResult = await client.query(
      `SELECT id FROM evaluations WHERE technology_id=$1 AND tenant_id=$2 AND status='active' AND blocking=1`,
      [techId, tenantId]
    );
    if (blockingResult.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'A blocking evaluation is active — complete it before transitioning' });
    }

    const cardResult = await client.query(
      `SELECT * FROM technology_cards WHERE technology_id=$1 AND tenant_id=$2`,
      [techId, tenantId]
    );
    const card = cardResult.rows[0];
    if (!card) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Technology card not found' });
    }

    const recordId = randomUUID();
    await client.query(
      `INSERT INTO decision_records (id, technology_id, tenant_id, state_before, state_after, rationale, adr_link, evidence_links, sunset_date, review_date, decision_maker_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [recordId, techId, tenantId, card.state, new_state, rationale, adr_link||null,
       evidence_links ? JSON.stringify(evidence_links) : null, sunset_date||null, review_date||null, req.session.userId]
    );

    await client.query(
      `UPDATE technology_cards SET state=$1, sunset_date=COALESCE($2,sunset_date), review_date=COALESCE($3,review_date),
       migration_target_id=COALESCE($4,migration_target_id), adr_link=COALESCE($5,adr_link),
       updated_at=EXTRACT(EPOCH FROM NOW())::BIGINT WHERE technology_id=$6 AND tenant_id=$7`,
      [new_state, sunset_date||null, review_date||null, migration_target_id||null, adr_link||null, techId, tenantId]
    );

    await client.query('COMMIT');

    const updatedCard = (await db.query(`SELECT * FROM technology_cards WHERE technology_id=$1`, [techId])).rows[0];
    const decisionRecord = (await db.query(`SELECT * FROM decision_records WHERE id=$1`, [recordId])).rows[0];

    res.status(201).json({ card: updatedCard, decision_record: decisionRecord });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// GET /api/technologies/:id/lifecycle/history
router.get('/history', requireTenantAccess, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT dr.*, u.username as decision_maker
       FROM decision_records dr
       LEFT JOIN users u ON u.id = dr.decision_maker_id
       WHERE dr.technology_id=$1 AND dr.tenant_id=$2
       ORDER BY dr.created_at DESC`,
      [req.params.id, req.tenant.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/technologies/:id/lifecycle/evaluations
router.get('/evaluations', requireTenantAccess, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT e.*, u.username as evaluator_username
       FROM evaluations e
       LEFT JOIN users u ON u.id = e.evaluator_id
       WHERE e.technology_id=$1 AND e.tenant_id=$2
       ORDER BY e.created_at DESC`,
      [req.params.id, req.tenant.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/technologies/:id/lifecycle/evaluations
router.post('/evaluations', requireRole('tco', 'tenant_admin'), async (req, res) => {
  const { evaluator_user_id, scope, start_date, end_date, blocking } = req.body;
  if (!evaluator_user_id) return res.status(400).json({ error: 'evaluator_user_id is required' });

  try {
    const id = randomUUID();
    await db.query(
      `INSERT INTO evaluations (id, technology_id, tenant_id, evaluator_id, scope, start_date, end_date, blocking)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, req.params.id, req.tenant.id, evaluator_user_id, scope||null, start_date||null, end_date||null, blocking ? 1 : 0]
    );

    const result = await db.query(`SELECT * FROM evaluations WHERE id=$1`, [id]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/technologies/:id/lifecycle/evaluations/:evalId
router.put('/evaluations/:evalId', requireTenantAccess, async (req, res) => {
  const { status, findings, recommendation, evidence_links } = req.body;
  try {
    await db.query(
      `UPDATE evaluations SET status=COALESCE($1,status), findings=COALESCE($2,findings),
       recommendation=COALESCE($3,recommendation), evidence_links=COALESCE($4,evidence_links),
       updated_at=EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id=$5 AND tenant_id=$6`,
      [status||null, findings||null, recommendation||null,
       evidence_links ? JSON.stringify(evidence_links) : null, req.params.evalId, req.tenant.id]
    );

    const result = await db.query(`SELECT * FROM evaluations WHERE id=$1`, [req.params.evalId]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
