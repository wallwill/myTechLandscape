'use strict';
const { Pool } = require('pg');

const db = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://mtp:mtp@172.17.152.86:5433/mtp',
});

module.exports = db;
