'use strict';
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/index');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  try {
    const result = await db.query(
      `SELECT * FROM users WHERE username = $1 AND tenant_id = $2 AND is_active = 1`,
      [username, req.tenant.id]
    );
    const user = result.rows[0];

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    req.session.userId     = user.id;
    req.session.username   = user.username;
    req.session.role       = user.role;
    req.session.tenantId   = req.tenant.id;
    req.session.tenantSlug = req.tenant.slug;

    res.json({
      id: user.id,
      username: user.username,
      role: user.role,
      tenantId: req.tenant.id,
      tenantName: req.tenant.name,
      tenantSlug: req.tenant.slug,
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get('/me', async (req, res) => {
  if (!req.session.userId) return res.json(null);
  try {
    const result = await db.query(
      `SELECT u.id, u.username, u.role, u.tenant_id, t.name AS tenant_name, t.slug AS tenant_slug
       FROM users u
       JOIN tenants t ON t.id = u.tenant_id
       WHERE u.id = $1 AND u.is_active = 1`,
      [req.session.userId]
    );
    const user = result.rows[0];
    res.json(user ? {
      id: user.id,
      username: user.username,
      role: user.role,
      tenantId: user.tenant_id,
      tenantName: user.tenant_name,
      tenantSlug: user.tenant_slug,
    } : null);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both passwords required' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  try {
    const result = await db.query(`SELECT * FROM users WHERE id = $1`, [req.session.userId]);
    const user = result.rows[0];
    if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    await db.query(
      `UPDATE users SET password_hash = $1 WHERE id = $2`,
      [bcrypt.hashSync(newPassword, 10), req.session.userId]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
