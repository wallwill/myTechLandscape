'use strict';
const { Pool } = require('pg');

const db = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://mtp:mtp@localhost:5432/mtp',
});

module.exports = db;
