const express = require('express');
const db = require('../db/index');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const teamId = req.query.team_id || req.session.teamId;
  if (!teamId) return res.json([]);
  res.json(db.prepare(`
    SELECT a.*, u.username as updated_by_username
    FROM assignments a LEFT JOIN users u ON a.updated_by = u.id
    WHERE a.team_id = ?
  `).all(teamId));
});

router.post('/', requireAuth, (req, res) => {
  const { projectId, projectName, stage, owner, notes, teamId } = req.body;
  if (!projectId) return res.status(400).json({ error: 'projectId required' });
  const tid = teamId || req.session.teamId;
  if (!tid) return res.status(400).json({ error: 'teamId required' });

  const existing = db.prepare(`SELECT stage FROM assignments WHERE project_id = ? AND team_id = ?`).get(projectId, tid);

  if (!stage) {
    db.prepare(`DELETE FROM assignments WHERE project_id = ? AND team_id = ?`).run(projectId, tid);
    if (existing) {
      db.prepare(`INSERT INTO audit_log (project_id, project_name, team_id, user_id, username, action, old_stage) VALUES (?,?,?,?,?,?,?)`)
        .run(projectId, projectName || projectId, tid, req.session.userId, req.session.username, 'remove', existing.stage);
    }
  } else {
    db.prepare(`
      INSERT INTO assignments (project_id, team_id, stage, owner, notes, updated_at, updated_by)
      VALUES (?, ?, ?, ?, ?, strftime('%s','now'), ?)
      ON CONFLICT(project_id, team_id) DO UPDATE SET
        stage=excluded.stage, owner=excluded.owner, notes=excluded.notes,
        updated_at=excluded.updated_at, updated_by=excluded.updated_by
    `).run(projectId, tid, stage, owner || null, notes || null, req.session.userId);

    db.prepare(`INSERT INTO audit_log (project_id, project_name, team_id, user_id, username, action, old_stage, new_stage, notes) VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(projectId, projectName || projectId, tid, req.session.userId, req.session.username,
        existing ? 'update' : 'assign', existing?.stage || null, stage, notes || null);
  }

  res.json({ ok: true });
});

module.exports = router;
