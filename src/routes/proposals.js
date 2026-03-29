'use strict';
/**
 * Proposals Route
 * Spec: specs/proposals.md
 */

const express = require('express');
const { randomUUID } = require('crypto');
const db = require('../db/index');
const { requireRole } = require('../middleware/rbac');
const { requireTenantAccess } = require('../middleware/tenant');

const router = express.Router();

// GET /api/proposals
router.get('/', requireTenantAccess, async (req, res) => {
  const { status, type } = req.query;
  let query = `SELECT p.*, u.username as requestor_username FROM proposals p LEFT JOIN users u ON u.id=p.requestor_id WHERE p.tenant_id=$1`;
  const params = [req.tenant.id];
  let idx = 2;

  if (status) { query += ` AND p.status=$${idx++}`; params.push(status); }
  if (type)   { query += ` AND p.type=$${idx++}`;   params.push(type); }

  query += ` ORDER BY p.created_at DESC`;

  try {
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/proposals
router.post('/', requireTenantAccess, async (req, res) => {
  const { type, technology_name, technology_id, capability_id, proposed_state, justification, evidence_links, requestor_lob } = req.body;
  if (!type) return res.status(400).json({ error: 'type is required' });
  if (!justification) return res.status(400).json({ error: 'justification is required' });

  try {
    const id = randomUUID();
    await db.query(
      `INSERT INTO proposals (id, tenant_id, type, technology_id, technology_name, capability_id, proposed_state, justification, evidence_links, requestor_id, requestor_lob)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [id, req.tenant.id, type, technology_id||null, technology_name||null, capability_id||null,
       proposed_state||null, justification, evidence_links ? JSON.stringify(evidence_links) : null,
       req.session.userId, requestor_lob||null]
    );

    const result = await db.query(`SELECT * FROM proposals WHERE id=$1`, [id]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/proposals/:id
router.get('/:id', requireTenantAccess, async (req, res) => {
  try {
    const proposalResult = await db.query(
      `SELECT * FROM proposals WHERE id=$1 AND tenant_id=$2`,
      [req.params.id, req.tenant.id]
    );
    const proposal = proposalResult.rows[0];
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });

    const feedbackResult = await db.query(
      `SELECT pf.*, u.username FROM proposal_feedback pf LEFT JOIN users u ON u.id=pf.author_id WHERE pf.proposal_id=$1 ORDER BY pf.created_at`,
      [req.params.id]
    );

    res.json({ ...proposal, feedback: feedbackResult.rows });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/proposals/:id/feedback
router.post('/:id/feedback', requireRole('tco', 'technology_owner', 'tenant_admin'), async (req, res) => {
  const { status, comment } = req.body;
  if (!comment) return res.status(400).json({ error: 'comment is required' });

  try {
    const feedbackId = randomUUID();
    await db.query(
      `INSERT INTO proposal_feedback (id, proposal_id, author_id, comment, status_set) VALUES ($1,$2,$3,$4,$5)`,
      [feedbackId, req.params.id, req.session.userId, comment, status||null]
    );

    if (status) {
      await db.query(
        `UPDATE proposals SET status=$1, updated_at=EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id=$2 AND tenant_id=$3`,
        [status, req.params.id, req.tenant.id]
      );
    }

    const result = await db.query(`SELECT * FROM proposal_feedback WHERE id=$1`, [feedbackId]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/proposals/:id/decision
router.put('/:id/decision', requireRole('tco', 'tenant_admin'), async (req, res) => {
  const { decision, decision_notes, create_card, initial_state } = req.body;
  if (!decision || !['approved', 'rejected'].includes(decision)) {
    return res.status(400).json({ error: 'decision must be approved or rejected' });
  }

  try {
    await db.query(
      `UPDATE proposals SET status=$1, reviewer_id=$2, decision_notes=$3,
       decided_at=EXTRACT(EPOCH FROM NOW())::BIGINT, updated_at=EXTRACT(EPOCH FROM NOW())::BIGINT
       WHERE id=$4 AND tenant_id=$5`,
      [decision, req.session.userId, decision_notes||null, req.params.id, req.tenant.id]
    );

    if (decision === 'approved' && create_card) {
      const proposalResult = await db.query(`SELECT * FROM proposals WHERE id=$1`, [req.params.id]);
      const proposal = proposalResult.rows[0];
      if (proposal.technology_name && !proposal.technology_id) {
        const techId = randomUUID();
        const slugId = `tech-${proposal.technology_name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
        await db.query(
          `INSERT INTO technologies (id, tenant_id, tech_id, name, capability_id) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
          [techId, req.tenant.id, slugId, proposal.technology_name, proposal.capability_id||null]
        );

        const cardId = randomUUID();
        await db.query(
          `INSERT INTO technology_cards (id, technology_id, tenant_id, state) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
          [cardId, techId, req.tenant.id, initial_state||'Emerging']
        );
      }
    }

    const result = await db.query(`SELECT * FROM proposals WHERE id=$1`, [req.params.id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
