'use strict';
/**
 * Sunset & Review-Due Reporting Module
 * Spec: specs/reporting.md
 */

const db = require('../db/index');

async function getSunsetCalendar(tenantId, daysAhead = 90) {
  const cutoff = Math.floor(Date.now() / 1000) + daysAhead * 24 * 3600;
  const now = Math.floor(Date.now() / 1000);

  const result = await db.query(
    `SELECT t.id, t.name, t.tech_id, tc.state, tc.sunset_date, tc.usage_tier,
            CAST((tc.sunset_date - EXTRACT(EPOCH FROM NOW())::BIGINT) / 86400 AS INTEGER) as days_until_sunset,
            c.name as capability_name
     FROM technologies t
     JOIN technology_cards tc ON tc.technology_id = t.id
     LEFT JOIN capabilities c ON c.id = t.capability_id
     WHERE t.tenant_id=$1 AND t.is_active=1 AND tc.sunset_date IS NOT NULL
       AND tc.sunset_date >= $2 AND tc.sunset_date <= $3
     ORDER BY tc.sunset_date ASC`,
    [tenantId, now, cutoff]
  );
  return result.rows;
}

async function getReviewDue(tenantId, daysOverdue = 0) {
  const threshold = Math.floor(Date.now() / 1000) - daysOverdue * 24 * 3600;

  const result = await db.query(
    `SELECT t.id, t.name, t.tech_id, tc.state, tc.review_date, tc.usage_tier,
            CAST((EXTRACT(EPOCH FROM NOW())::BIGINT - tc.review_date) / 86400 AS INTEGER) as days_overdue,
            c.name as capability_name,
            u.username as owner_username
     FROM technologies t
     JOIN technology_cards tc ON tc.technology_id = t.id
     LEFT JOIN capabilities c ON c.id = t.capability_id
     LEFT JOIN users u ON u.id = tc.owner_user_id
     WHERE t.tenant_id=$1 AND t.is_active=1 AND tc.review_date IS NOT NULL
       AND tc.review_date <= $2
     ORDER BY tc.review_date ASC`,
    [tenantId, threshold]
  );
  return result.rows;
}

async function getCoverage(tenantId) {
  const totalResult = await db.query(
    `SELECT COUNT(*) as n FROM technologies WHERE tenant_id=$1 AND is_active=1`, [tenantId]
  );
  const total = Number(totalResult.rows[0].n);

  const fields = ['state', 'owner_user_id', 'review_date', 'sunset_date', 'adr_link', 'usage_tier'];
  const coverage = {};

  for (const field of fields) {
    const filledResult = await db.query(
      `SELECT COUNT(*) as n FROM technology_cards tc
       JOIN technologies t ON t.id=tc.technology_id
       WHERE tc.tenant_id=$1 AND t.is_active=1 AND tc.${field} IS NOT NULL`,
      [tenantId]
    );
    const filled = Number(filledResult.rows[0].n);
    coverage[field] = { filled, total, pct: total > 0 ? Math.round((filled / total) * 100) : 0 };
  }

  return { total_technologies: total, coverage };
}

module.exports = { getSunsetCalendar, getReviewDue, getCoverage };
