const express = require('express');
const db = require('../db/index');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  res.json(db.prepare(`SELECT * FROM teams ORDER BY name`).all());
});

router.post('/', requireAdmin, (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Name required' });
  try {
    const result = db.prepare(`INSERT INTO teams (name) VALUES (?)`).run(name);
    res.json(db.prepare(`SELECT * FROM teams WHERE id = ?`).get(result.lastInsertRowid));
  } catch (e) {
    res.status(409).json({ error: 'Team name already exists' });
  }
});

router.delete('/:id', requireAdmin, (req, res) => {
  db.prepare(`DELETE FROM teams WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
