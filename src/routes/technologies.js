'use strict';
/**
 * Technologies Route
 * Spec: specs/technologies.md
 */

const express = require('express');
const { randomUUID } = require('crypto');
const db = require('../db/index');
const { requireRole } = require('../middleware/rbac');
const { requireTenantAccess } = require('../middleware/tenant');

const router = express.Router();

// GET /api/technologies
router.get('/', requireTenantAccess, async (req, res) => {
  const tenantId = req.tenant.id;
  const { capability_id, state, source, search, page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;

  let where = `t.tenant_id = $1 AND t.is_active = 1`;
  const params = [tenantId];
  let idx = 2;

  if (capability_id) { where += ` AND t.capability_id = $${idx++}`; params.push(capability_id); }
  if (state)         { where += ` AND tc.state = $${idx++}`;         params.push(state); }
  if (source)        { where += ` AND t.source = $${idx++}`;         params.push(source); }
  if (search)        { where += ` AND t.name ILIKE $${idx++}`;       params.push(`%${search}%`); }

  try {
    const totalResult = await db.query(
      `SELECT COUNT(*) as n FROM technologies t JOIN technology_cards tc ON tc.technology_id = t.id WHERE ${where}`,
      params
    );
    const total = Number(totalResult.rows[0].n);

    const itemsResult = await db.query(
      `SELECT t.id, t.tech_id, t.name, t.provider, t.source, tc.state, tc.usage_tier, tc.sunset_date,
              c.name as capability_name
       FROM technologies t
       JOIN technology_cards tc ON tc.technology_id = t.id
       LEFT JOIN capabilities c ON c.id = t.capability_id
       WHERE ${where}
       ORDER BY t.name LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, Number(limit), offset]
    );

    res.json({ total, items: itemsResult.rows });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/technologies/:id
router.get('/:id', requireTenantAccess, async (req, res) => {
  const tenantId = req.tenant.id;

  try {
    const techResult = await db.query(
      `SELECT t.*, tc.id as card_id, tc.state, tc.review_date, tc.sunset_date,
              tc.usage_tier, tc.owner_user_id, tc.adr_link, tc.migration_target_id,
              c.name as capability_name,
              u.username as owner_username, u.display_name as owner_display_name
       FROM technologies t
       JOIN technology_cards tc ON tc.technology_id = t.id
       LEFT JOIN capabilities c ON c.id = t.capability_id
       LEFT JOIN users u ON u.id = tc.owner_user_id
       WHERE t.id = $1 AND t.tenant_id = $2`,
      [req.params.id, tenantId]
    );

    const tech = techResult.rows[0];
    if (!tech) return res.status(404).json({ error: 'Technology not found' });

    const metricsResult = await db.query(
      `SELECT metric_key, metric_value FROM technology_metrics WHERE technology_id = $1 AND tenant_id = $2`,
      [tech.id, tenantId]
    );

    const exceptionsResult = await db.query(
      `SELECT * FROM lob_exceptions WHERE technology_id = $1 AND tenant_id = $2 AND is_active = 1`,
      [tech.id, tenantId]
    );

    res.json({ ...tech, metrics: metricsResult.rows, active_exceptions: exceptionsResult.rows });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/technologies
router.post('/', requireRole('tenant_admin', 'tco'), async (req, res) => {
  const { tech_id, name, version_range, capability_id, provider, source, homepage_url, description } = req.body;
  if (!tech_id || !name) return res.status(400).json({ error: 'tech_id and name are required' });

  const tenantId = req.tenant.id;

  try {
    const existing = await db.query(
      `SELECT id FROM technologies WHERE tenant_id = $1 AND tech_id = $2`, [tenantId, tech_id]
    );
    if (existing.rows[0]) return res.status(409).json({ error: 'tech_id already exists for tenant' });

    const id = randomUUID();
    await db.query(
      `INSERT INTO technologies (id, tenant_id, tech_id, name, version_range, capability_id, provider, source, homepage_url, description)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [id, tenantId, tech_id, name, version_range||null, capability_id||null, provider||null, source||'custom', homepage_url||null, description||null]
    );

    // Auto-create technology card
    const cardId = randomUUID();
    await db.query(
      `INSERT INTO technology_cards (id, technology_id, tenant_id, state) VALUES ($1,$2,$3,'Emerging')`,
      [cardId, id, tenantId]
    );

    const result = await db.query(`SELECT * FROM technologies WHERE id = $1`, [id]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'tech_id already exists for tenant' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/technologies/:id
router.put('/:id', requireRole('tenant_admin', 'tco', 'technology_owner'), async (req, res) => {
  const { name, version_range, capability_id, provider, homepage_url, description } = req.body;
  try {
    await db.query(
      `UPDATE technologies SET name=COALESCE($1,name), version_range=COALESCE($2,version_range),
       capability_id=COALESCE($3,capability_id), provider=COALESCE($4,provider),
       homepage_url=COALESCE($5,homepage_url), description=COALESCE($6,description)
       WHERE id=$7 AND tenant_id=$8`,
      [name||null, version_range||null, capability_id||null, provider||null, homepage_url||null, description||null,
       req.params.id, req.tenant.id]
    );
    const result = await db.query(`SELECT * FROM technologies WHERE id = $1`, [req.params.id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/technologies/:id
router.delete('/:id', requireRole('tenant_admin'), async (req, res) => {
  try {
    const activeExceptions = await db.query(
      `SELECT COUNT(*) as n FROM lob_exceptions WHERE technology_id = $1 AND tenant_id = $2 AND is_active = 1`,
      [req.params.id, req.tenant.id]
    );

    if (Number(activeExceptions.rows[0].n) > 0) {
      return res.status(409).json({ error: 'Technology has active LOB exceptions' });
    }

    await db.query(
      `UPDATE technologies SET is_active = 0 WHERE id = $1 AND tenant_id = $2`,
      [req.params.id, req.tenant.id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/technologies/:id/card
router.get('/:id/card', requireTenantAccess, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT tc.* FROM technology_cards tc
       JOIN technologies t ON t.id = tc.technology_id
       WHERE tc.technology_id = $1 AND tc.tenant_id = $2`,
      [req.params.id, req.tenant.id]
    );

    if (!result.rows[0]) return res.status(404).json({ error: 'Card not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/technologies/:id/card
router.put('/:id/card', requireRole('technology_owner', 'tco'), async (req, res) => {
  const { usage_tier, sunset_date, adr_link, owner_user_id } = req.body;
  try {
    await db.query(
      `UPDATE technology_cards SET usage_tier=COALESCE($1,usage_tier), sunset_date=COALESCE($2,sunset_date),
       adr_link=COALESCE($3,adr_link), owner_user_id=COALESCE($4,owner_user_id),
       updated_at=EXTRACT(EPOCH FROM NOW())::BIGINT WHERE technology_id=$5 AND tenant_id=$6`,
      [usage_tier||null, sunset_date||null, adr_link||null, owner_user_id||null, req.params.id, req.tenant.id]
    );
    const result = await db.query(`SELECT * FROM technology_cards WHERE technology_id = $1`, [req.params.id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
