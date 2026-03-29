const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/index');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAdmin, (req, res) => {
  res.json(db.prepare(`
    SELECT u.id, u.username, u.role, u.team_id, t.name as team_name, u.created_at
    FROM users u LEFT JOIN teams t ON u.team_id = t.id ORDER BY u.username
  `).all());
});

router.post('/', requireAdmin, (req, res) => {
  const { username, password, role, teamId } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  try {
    const result = db.prepare(`INSERT INTO users (username, password_hash, role, team_id) VALUES (?, ?, ?, ?)`)
      .run(username.trim(), bcrypt.hashSync(password, 10), role || 'member', teamId || null);
    const user = db.prepare(`SELECT id, username, role, team_id FROM users WHERE id = ?`).get(result.lastInsertRowid);
    res.json(user);
  } catch (e) {
    res.status(409).json({ error: 'Username already exists' });
  }
});

router.delete('/:id', requireAdmin, (req, res) => {
  if (parseInt(req.params.id) === req.session.userId) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }
  db.prepare(`DELETE FROM users WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
