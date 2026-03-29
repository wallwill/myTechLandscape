'use strict';
const db = require('./index');
const SCHEMA = require('./schema');

async function initDb() {
  for (const statement of SCHEMA) {
    await db.query(statement);
  }
}

module.exports = initDb;
