'use strict';
/**
 * Export Module — CSV & JSON
 * Spec: specs/reporting.md
 */

const db = require('../db/index');

async function buildQuery(tenantId, { state, capability_id }) {
  let where = `t.tenant_id=$1 AND t.is_active=1`;
  const params = [tenantId];
  let idx = 2;

  if (state)         { where += ` AND tc.state=$${idx++}`;          params.push(state); }
  if (capability_id) { where += ` AND t.capability_id=$${idx++}`;   params.push(capability_id); }

  const result = await db.query(
    `SELECT t.tech_id, t.name, t.provider, t.source, t.version_range, t.homepage_url,
            tc.state, tc.usage_tier, tc.sunset_date, tc.review_date, tc.adr_link,
            c.name as capability, u.username as owner
     FROM technologies t
     JOIN technology_cards tc ON tc.technology_id = t.id
     LEFT JOIN capabilities c ON c.id = t.capability_id
     LEFT JOIN users u ON u.id = tc.owner_user_id
     WHERE ${where}
     ORDER BY c.name, t.name`,
    params
  );

  return result.rows;
}

async function exportJson(tenantId, filters = {}) {
  const rows = await buildQuery(tenantId, filters);
  if (!filters.include_metrics && !filters.include_exceptions) return rows;

  return Promise.all(rows.map(async (row) => {
    const result = { ...row };

    if (filters.include_metrics) {
      const metricsResult = await db.query(
        `SELECT metric_key, metric_value FROM technology_metrics
         WHERE technology_id=(SELECT id FROM technologies WHERE tenant_id=$1 AND tech_id=$2) AND tenant_id=$3`,
        [tenantId, row.tech_id, tenantId]
      );
      result.metrics = Object.fromEntries(metricsResult.rows.map(m => [m.metric_key, m.metric_value]));
    }

    if (filters.include_exceptions) {
      const exceptionsResult = await db.query(
        `SELECT lob, exception_type, conditions, expires_at FROM lob_exceptions
         WHERE technology_id=(SELECT id FROM technologies WHERE tenant_id=$1 AND tech_id=$2) AND tenant_id=$3 AND is_active=1`,
        [tenantId, row.tech_id, tenantId]
      );
      result.exceptions = exceptionsResult.rows;
    }

    return result;
  }));
}

async function exportCsv(tenantId, filters = {}) {
  const rows = await exportJson(tenantId, filters);

  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const toDate = (ts) => ts ? new Date(ts * 1000).toISOString().split('T')[0] : '';

  const headers = ['tech_id', 'name', 'provider', 'source', 'version_range', 'capability',
                   'state', 'usage_tier', 'sunset_date', 'review_date', 'adr_link', 'owner', 'homepage_url'];

  const lines = [headers.map(escape).join(',')];

  for (const row of rows) {
    const values = [
      row.tech_id, row.name, row.provider, row.source, row.version_range,
      row.capability, row.state, row.usage_tier,
      toDate(row.sunset_date), toDate(row.review_date),
      row.adr_link, row.owner, row.homepage_url,
    ];
    lines.push(values.map(escape).join(','));
  }

  return lines.join('\n');
}

module.exports = { exportJson, exportCsv };
