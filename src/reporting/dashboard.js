'use strict';
/**
 * Dashboard Reporting Module
 * Spec: specs/reporting.md
 */

const db = require('../db/index');

async function getDashboard(tenantId) {
  const totalResult = await db.query(
    `SELECT COUNT(*) as n FROM technologies WHERE tenant_id=$1 AND is_active=1`, [tenantId]
  );
  const total = Number(totalResult.rows[0].n);

  const byStateResult = await db.query(
    `SELECT tc.state, COUNT(*) as count
     FROM technology_cards tc
     JOIN technologies t ON t.id = tc.technology_id
     WHERE tc.tenant_id=$1 AND t.is_active=1
     GROUP BY tc.state`,
    [tenantId]
  );
  const byState = byStateResult.rows.reduce((acc, row) => { acc[row.state] = Number(row.count); return acc; }, {});

  const byCapabilityResult = await db.query(
    `SELECT c.name, COUNT(*) as count
     FROM technologies t
     LEFT JOIN capabilities c ON c.id = t.capability_id
     WHERE t.tenant_id=$1 AND t.is_active=1
     GROUP BY c.id, c.name
     ORDER BY count DESC LIMIT 20`,
    [tenantId]
  );

  const overdueResult = await db.query(
    `SELECT COUNT(*) as n FROM technology_cards tc
     JOIN technologies t ON t.id=tc.technology_id
     WHERE tc.tenant_id=$1 AND t.is_active=1 AND tc.review_date IS NOT NULL
       AND tc.review_date < EXTRACT(EPOCH FROM NOW())::BIGINT`,
    [tenantId]
  );

  const expiringResult = await db.query(
    `SELECT COUNT(*) as n FROM lob_exceptions
     WHERE tenant_id=$1 AND is_active=1 AND expires_at IS NOT NULL
       AND expires_at < (EXTRACT(EPOCH FROM NOW())::BIGINT + 30*24*3600)`,
    [tenantId]
  );

  const activeEvalsResult = await db.query(
    `SELECT COUNT(*) as n FROM evaluations WHERE tenant_id=$1 AND status='active'`, [tenantId]
  );

  const pendingProposalsResult = await db.query(
    `SELECT COUNT(*) as n FROM proposals WHERE tenant_id=$1 AND status='pending'`, [tenantId]
  );

  const recentDecisionsResult = await db.query(
    `SELECT dr.state_before, dr.state_after, dr.created_at, t.name as technology_name, u.username as decision_maker
     FROM decision_records dr
     JOIN technologies t ON t.id=dr.technology_id
     LEFT JOIN users u ON u.id=dr.decision_maker_id
     WHERE dr.tenant_id=$1
     ORDER BY dr.created_at DESC LIMIT 10`,
    [tenantId]
  );

  return {
    total_technologies: total,
    by_state: byState,
    by_capability: byCapabilityResult.rows,
    overdue_reviews: Number(overdueResult.rows[0].n),
    expiring_exceptions: Number(expiringResult.rows[0].n),
    active_evaluations: Number(activeEvalsResult.rows[0].n),
    pending_proposals: Number(pendingProposalsResult.rows[0].n),
    recent_decisions: recentDecisionsResult.rows,
  };
}

module.exports = { getDashboard };
