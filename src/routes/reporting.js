'use strict';
/**
 * Reporting Route
 * Spec: specs/reporting.md
 */

const express = require('express');
const { requireTenantAccess } = require('../middleware/tenant');
const { getDashboard } = require('../reporting/dashboard');
const { getSunsetCalendar, getReviewDue, getCoverage } = require('../reporting/sunset');
const { exportJson, exportCsv } = require('../reporting/exports');

const router = express.Router();

// GET /api/reporting/dashboard
router.get('/dashboard', requireTenantAccess, async (req, res) => {
  try {
    res.json(await getDashboard(req.tenant.id));
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/reporting/sunset-calendar
router.get('/sunset-calendar', requireTenantAccess, async (req, res) => {
  const daysAhead = Number(req.query.days_ahead) || 90;
  try {
    res.json(await getSunsetCalendar(req.tenant.id, daysAhead));
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/reporting/review-due
router.get('/review-due', requireTenantAccess, async (req, res) => {
  const daysOverdue = Number(req.query.days_overdue) || 0;
  try {
    res.json(await getReviewDue(req.tenant.id, daysOverdue));
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/reporting/coverage
router.get('/coverage', requireTenantAccess, async (req, res) => {
  try {
    res.json(await getCoverage(req.tenant.id));
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/export/csv
router.get('/export/csv', requireTenantAccess, async (req, res) => {
  const filters = {
    state: req.query.state,
    capability_id: req.query.capability_id,
    include_metrics: req.query.include_metrics === 'true',
    include_exceptions: req.query.include_exceptions === 'true',
  };
  try {
    const csv = await exportCsv(req.tenant.id, filters);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="technology-portfolio.csv"');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/export/json
router.get('/export/json', requireTenantAccess, async (req, res) => {
  const filters = {
    state: req.query.state,
    capability_id: req.query.capability_id,
    include_metrics: req.query.include_metrics === 'true',
    include_exceptions: req.query.include_exceptions === 'true',
  };
  try {
    res.json(await exportJson(req.tenant.id, filters));
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
