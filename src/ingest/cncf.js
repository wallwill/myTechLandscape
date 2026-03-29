'use strict';
/**
 * CNCF Landscape Ingestion Pipeline
 * Spec: specs/ingest.md
 */

const yaml = require('js-yaml');
const fetch = require('node-fetch');
const { randomUUID } = require('crypto');
const db = require('../db/index');

const CNCF_URL = 'https://raw.githubusercontent.com/cncf/landscape/master/landscape.yml';

async function runCncfIngest(tenantId, sourceId, triggeredBy = null) {
  const jobId = randomUUID();
  const now = Math.floor(Date.now() / 1000);

  await db.query(
    `INSERT INTO ingest_jobs (id, tenant_id, source_id, status, started_at, triggered_by)
     VALUES ($1, $2, $3, 'running', $4, $5)`,
    [jobId, tenantId, sourceId, now, triggeredBy]
  );

  const stats = { created: 0, updated: 0, skipped: 0, errors: [] };

  const client = await db.connect();
  try {
    const res = await fetch(CNCF_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const parsed = yaml.load(await res.text());

    await client.query('BEGIN');

    for (const category of parsed.landscape || []) {
      // Upsert top-level capability
      const capId = await upsertCapability(client, tenantId, category.name, null, stats);

      for (const subcategory of category.subcategories || []) {
        // Upsert child capability
        const subCapId = await upsertCapability(client, tenantId, subcategory.name, capId, stats);

        for (const item of subcategory.items || []) {
          await upsertTechnology(client, tenantId, item, subCapId, stats);
        }
      }
    }

    await client.query('COMMIT');

    const completedAt = Math.floor(Date.now() / 1000);
    await db.query(
      `UPDATE ingest_jobs SET status='completed', completed_at=$1, stats=$2 WHERE id=$3`,
      [completedAt, JSON.stringify(stats), jobId]
    );
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    const completedAt = Math.floor(Date.now() / 1000);
    await db.query(
      `UPDATE ingest_jobs SET status='failed', completed_at=$1, error_log=$2 WHERE id=$3`,
      [completedAt, err.message, jobId]
    );
  } finally {
    client.release();
  }

  return jobId;
}

async function upsertCapability(client, tenantId, name, parentId, stats) {
  const existing = await client.query(
    `SELECT id FROM capabilities WHERE tenant_id=$1 AND name=$2 AND (parent_id IS NOT DISTINCT FROM $3)`,
    [tenantId, name, parentId]
  );

  if (existing.rows[0]) { stats.skipped++; return existing.rows[0].id; }

  const id = randomUUID();
  await client.query(
    `INSERT INTO capabilities (id, tenant_id, name, parent_id, source) VALUES ($1,$2,$3,$4,'cncf')`,
    [id, tenantId, name, parentId]
  );
  stats.created++;
  return id;
}

async function upsertTechnology(client, tenantId, item, capabilityId, stats) {
  const techId = `tech-${item.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
  const existing = await client.query(
    `SELECT id FROM technologies WHERE tenant_id=$1 AND tech_id=$2`, [tenantId, techId]
  );

  if (existing.rows[0]) {
    // Don't overwrite tenant customizations — only update metadata
    await client.query(
      `UPDATE technologies SET description=$1, homepage_url=$2, logo=$3 WHERE id=$4`,
      [item.description || null, item.homepage_url || null, item.logo || null, existing.rows[0].id]
    );
    stats.updated++;
    return;
  }

  const id = randomUUID();
  await client.query(
    `INSERT INTO technologies (id,tenant_id,tech_id,name,capability_id,provider,source,homepage_url,logo,description)
     VALUES ($1,$2,$3,$4,$5,'CNCF','cncf',$6,$7,$8)`,
    [id, tenantId, techId, item.name, capabilityId, item.homepage_url||null, item.logo||null, item.description||null]
  );

  // Create default Emerging card
  const cardId = randomUUID();
  await client.query(
    `INSERT INTO technology_cards (id, technology_id, tenant_id, state) VALUES ($1,$2,$3,'Emerging')`,
    [cardId, id, tenantId]
  );

  stats.created++;
}

module.exports = { runCncfIngest };
