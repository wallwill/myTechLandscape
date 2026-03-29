'use strict';
const express = require('express');
const session = require('express-session');
const path = require('path');

const initDb = require('./src/db/init');
const seed = require('./src/db/seed');
const { resolveTenant } = require('./src/middleware/tenant');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'mtp-dev-secret-change-in-prod',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 },
}));

app.use(express.static(path.join(__dirname, 'public')));

// Resolve tenant for every API request
app.use('/api', resolveTenant);

// Routes
app.use('/api/auth',         require('./src/routes/auth'));
app.use('/api/landscape',    require('./src/routes/landscape'));
app.use('/api/tenants',      require('./src/routes/tenants'));
app.use('/api/tcm',          require('./src/routes/tcm'));
app.use('/api/technologies', require('./src/routes/technologies'));
app.use('/api/lifecycle',    require('./src/routes/lifecycle'));
app.use('/api/users',        require('./src/routes/operating-model'));
app.use('/api/patterns',     require('./src/routes/patterns'));
app.use('/api/exceptions',   require('./src/routes/exceptions'));
app.use('/api/metrics',      require('./src/routes/metrics'));
app.use('/api/proposals',    require('./src/routes/proposals'));
app.use('/api/audit',        require('./src/routes/audit'));
app.use('/api/reporting',    require('./src/routes/reporting'));

async function start() {
  await initDb();
  await seed();
  app.listen(PORT, () => console.log(`MyTechnologyPolicy running at http://localhost:${PORT}`));
}

start().catch(err => { console.error('Startup failed:', err); process.exit(1); });
