const express = require('express');
const db = require('../db/index');
const { requireAuth } = require('../middleware/auth');
const { fetchLandscape } = require('./landscape');

const router = express.Router();

router.get('/csv', requireAuth, async (req, res) => {
  const teamId = req.query.team_id || req.session.teamId;
  const projects = await fetchLandscape();
  const assignments = teamId ? db.prepare(`SELECT * FROM assignments WHERE team_id = ?`).all(teamId) : [];
  const assignMap = {};
  assignments.forEach(a => { assignMap[a.project_id] = a; });

  const rows = projects.map(p => {
    const a = assignMap[p.id] || {};
    return [p.name, p.category, p.subcategory, p.project || '', a.stage || '', a.owner || '', a.notes || '',
      a.updated_at ? new Date(a.updated_at * 1000).toISOString() : '', a.updated_by_username || '']
      .map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
  });

  const csv = ['Name,Category,Subcategory,CNCF Status,Stage,Owner,Notes,Last Updated,Updated By', ...rows].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="cncf-landscape-assignments.csv"');
  res.send(csv);
});

module.exports = router;
