'use strict';
/**
 * MyTechnologyPolicy MCP Server
 * Spec: specs/mcp-server.md
 *
 * Exposes technology lifecycle data to AI agents via Model Context Protocol.
 * All tools are tenant-aware via service token authentication.
 */

const db = require('../db/index');

// Tool: get_technology_card
async function getTechnologyCard({ tech_id, include_patterns = true, include_metrics = true, lob }, tenantId) {
  const techResult = await db.query(`
    SELECT t.*, tc.state, tc.review_date, tc.sunset_date, tc.usage_tier, tc.adr_link, tc.owner_user_id
    FROM technologies t
    JOIN technology_cards tc ON tc.technology_id = t.id
    WHERE t.tenant_id = $1 AND (t.tech_id = $2 OR LOWER(t.name) = LOWER($3))
  `, [tenantId, tech_id, tech_id]);

  const tech = techResult.rows[0];
  if (!tech) return { error: `Technology '${tech_id}' not found` };

  const result = { ...tech };

  if (include_patterns) {
    const patternsResult = await db.query(
      `SELECT * FROM patterns WHERE technology_id = $1 AND tenant_id = $2`,
      [tech.id, tenantId]
    );
    result.patterns = patternsResult.rows;
  }

  if (include_metrics) {
    const metricsResult = await db.query(
      `SELECT metric_key, metric_value FROM technology_metrics WHERE technology_id = $1 AND tenant_id = $2`,
      [tech.id, tenantId]
    );
    result.metrics = Object.fromEntries(metricsResult.rows.map(r => [r.metric_key, r.metric_value]));
  }

  if (lob) {
    const lobResult = await db.query(`
      SELECT * FROM lob_exceptions
      WHERE technology_id = $1 AND tenant_id = $2 AND lob = $3 AND is_active = 1
    `, [tech.id, tenantId, lob]);
    result.lob_override = lobResult.rows[0] || null;
  }

  return result;
}

// Tool: list_technologies
async function listTechnologies({ state, capability, lob, include_emerging = false }, tenantId) {
  let query = `
    SELECT t.tech_id, t.name, t.provider, tc.state, tc.usage_tier, tc.sunset_date,
           c.name as capability_name
    FROM technologies t
    JOIN technology_cards tc ON tc.technology_id = t.id
    LEFT JOIN capabilities c ON c.id = t.capability_id
    WHERE t.tenant_id = $1 AND t.is_active = 1
  `;
  const params = [tenantId];
  let idx = 2;

  if (state) { query += ` AND tc.state = $${idx++}`; params.push(state); }
  if (!include_emerging) { query += ` AND tc.state != 'Emerging'`; }
  if (capability) { query += ` AND c.name ILIKE $${idx++}`; params.push(`%${capability}%`); }

  const result = await db.query(query, params);
  return result.rows;
}

// Tool: check_lob_exception
async function checkLobException({ tech_id, lob }, tenantId) {
  const techResult = await db.query(
    `SELECT id FROM technologies WHERE tenant_id = $1 AND (tech_id = $2 OR LOWER(name) = LOWER($3))`,
    [tenantId, tech_id, tech_id]
  );
  const tech = techResult.rows[0];

  if (!tech) return { has_exception: false, error: 'Technology not found' };

  const now = Math.floor(Date.now() / 1000);
  const exceptionResult = await db.query(`
    SELECT * FROM lob_exceptions
    WHERE technology_id = $1 AND tenant_id = $2 AND lob = $3 AND is_active = 1
      AND (expires_at IS NULL OR expires_at > $4)
  `, [tech.id, tenantId, lob, now]);

  const exception = exceptionResult.rows[0];

  return {
    has_exception: !!exception,
    type: exception?.exception_type || null,
    conditions: exception?.conditions || null,
    expires_at: exception?.expires_at || null,
  };
}

// Tool: get_decision_record
async function getDecisionRecord({ tech_id }, tenantId) {
  const techResult = await db.query(
    `SELECT id FROM technologies WHERE tenant_id = $1 AND (tech_id = $2 OR LOWER(name) = LOWER($3))`,
    [tenantId, tech_id, tech_id]
  );
  const tech = techResult.rows[0];

  if (!tech) return { error: 'Technology not found' };

  const result = await db.query(`
    SELECT dr.*, u.username as decision_maker
    FROM decision_records dr
    LEFT JOIN users u ON u.id = dr.decision_maker_id
    WHERE dr.technology_id = $1 AND dr.tenant_id = $2
    ORDER BY dr.created_at DESC LIMIT 1
  `, [tech.id, tenantId]);

  return result.rows[0] || null;
}

// MCP tool registry
const TOOLS = {
  get_technology_card:  getTechnologyCard,
  list_technologies:    listTechnologies,
  check_lob_exception:  checkLobException,
  get_decision_record:  getDecisionRecord,
};

async function handleMcpRequest(toolName, args, tenantId) {
  const tool = TOOLS[toolName];
  if (!tool) return { error: `Unknown tool: ${toolName}` };
  return tool(args, tenantId);
}

module.exports = { handleMcpRequest, TOOLS };
