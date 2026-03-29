'use strict';

module.exports = [
  // Tenants
  `CREATE TABLE IF NOT EXISTS tenants (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    slug         TEXT NOT NULL UNIQUE,
    config       JSONB NOT NULL DEFAULT '{}',
    is_active    INTEGER NOT NULL DEFAULT 1,
    created_at   BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
    updated_at   BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
  )`,

  // Users
  `CREATE TABLE IF NOT EXISTS users (
    id             TEXT PRIMARY KEY,
    tenant_id      TEXT NOT NULL REFERENCES tenants(id),
    username       TEXT NOT NULL,
    email          TEXT,
    display_name   TEXT,
    password_hash  TEXT NOT NULL,
    role           TEXT NOT NULL DEFAULT 'member',
    lob            TEXT,
    is_active      INTEGER DEFAULT 1,
    created_at     BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
    UNIQUE(tenant_id, username)
  )`,

  // Technical Capability Model
  `CREATE TABLE IF NOT EXISTS capabilities (
    id            TEXT PRIMARY KEY,
    tenant_id     TEXT NOT NULL REFERENCES tenants(id),
    name          TEXT NOT NULL,
    description   TEXT,
    parent_id     TEXT REFERENCES capabilities(id),
    owner_user_id TEXT REFERENCES users(id),
    source        TEXT DEFAULT 'custom',
    is_active     INTEGER DEFAULT 1,
    created_at    BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
    updated_at    BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
    UNIQUE(tenant_id, name, parent_id)
  )`,

  // Technologies
  `CREATE TABLE IF NOT EXISTS technologies (
    id             TEXT PRIMARY KEY,
    tenant_id      TEXT NOT NULL REFERENCES tenants(id),
    tech_id        TEXT NOT NULL,
    name           TEXT NOT NULL,
    version_range  TEXT,
    capability_id  TEXT REFERENCES capabilities(id),
    provider       TEXT,
    source         TEXT DEFAULT 'custom',
    homepage_url   TEXT,
    logo           TEXT,
    description    TEXT,
    is_active      INTEGER DEFAULT 1,
    created_at     BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
    UNIQUE(tenant_id, tech_id)
  )`,

  // Technology Cards
  `CREATE TABLE IF NOT EXISTS technology_cards (
    id                  TEXT PRIMARY KEY,
    technology_id       TEXT NOT NULL UNIQUE REFERENCES technologies(id),
    tenant_id           TEXT NOT NULL REFERENCES tenants(id),
    state               TEXT NOT NULL DEFAULT 'Emerging',
    review_date         BIGINT,
    sunset_date         BIGINT,
    usage_tier          TEXT,
    owner_user_id       TEXT REFERENCES users(id),
    adr_link            TEXT,
    migration_target_id TEXT REFERENCES technologies(id),
    created_at          BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
    updated_at          BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
  )`,

  // Decision Records
  `CREATE TABLE IF NOT EXISTS decision_records (
    id                TEXT PRIMARY KEY,
    technology_id     TEXT NOT NULL REFERENCES technologies(id),
    tenant_id         TEXT NOT NULL REFERENCES tenants(id),
    state_before      TEXT,
    state_after       TEXT NOT NULL,
    rationale         TEXT NOT NULL,
    adr_link          TEXT,
    evidence_links    TEXT,
    sunset_date       TEXT,
    review_date       TEXT,
    decision_maker_id TEXT NOT NULL REFERENCES users(id),
    created_at        BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
  )`,

  // Evaluations
  `CREATE TABLE IF NOT EXISTS evaluations (
    id             TEXT PRIMARY KEY,
    technology_id  TEXT NOT NULL REFERENCES technologies(id),
    tenant_id      TEXT NOT NULL REFERENCES tenants(id),
    evaluator_id   TEXT NOT NULL REFERENCES users(id),
    scope          TEXT,
    start_date     BIGINT,
    end_date       BIGINT,
    status         TEXT DEFAULT 'active',
    findings       TEXT,
    recommendation TEXT,
    evidence_links TEXT,
    blocking       INTEGER DEFAULT 0,
    created_at     BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
    updated_at     BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
  )`,

  // Patterns
  `CREATE TABLE IF NOT EXISTS patterns (
    id             TEXT PRIMARY KEY,
    technology_id  TEXT NOT NULL REFERENCES technologies(id),
    tenant_id      TEXT NOT NULL REFERENCES tenants(id),
    type           TEXT NOT NULL,
    title          TEXT NOT NULL,
    content        TEXT NOT NULL,
    code_sample    TEXT,
    language       TEXT,
    tags           TEXT,
    source_url     TEXT,
    created_by     TEXT REFERENCES users(id),
    created_at     BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
    updated_at     BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
  )`,

  // LOB Exceptions
  `CREATE TABLE IF NOT EXISTS lob_exceptions (
    id                  TEXT PRIMARY KEY,
    technology_id       TEXT NOT NULL REFERENCES technologies(id),
    tenant_id           TEXT NOT NULL REFERENCES tenants(id),
    lob                 TEXT NOT NULL,
    exception_type      TEXT NOT NULL,
    justification       TEXT NOT NULL,
    conditions          TEXT,
    expires_at          BIGINT,
    migration_target_id TEXT REFERENCES technologies(id),
    approved_by         TEXT REFERENCES users(id),
    is_active           INTEGER DEFAULT 1,
    created_at          BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
    updated_at          BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
  )`,

  // Metric Definitions
  `CREATE TABLE IF NOT EXISTS metric_definitions (
    id           TEXT PRIMARY KEY,
    tenant_id    TEXT NOT NULL REFERENCES tenants(id),
    key          TEXT NOT NULL,
    label        TEXT NOT NULL,
    type         TEXT NOT NULL,
    enum_values  TEXT,
    required     INTEGER DEFAULT 0,
    description  TEXT,
    is_builtin   INTEGER DEFAULT 0,
    UNIQUE(tenant_id, key)
  )`,

  // Technology Metrics
  `CREATE TABLE IF NOT EXISTS technology_metrics (
    id             TEXT PRIMARY KEY,
    technology_id  TEXT NOT NULL REFERENCES technologies(id),
    tenant_id      TEXT NOT NULL,
    metric_key     TEXT NOT NULL,
    metric_value   TEXT,
    updated_by     TEXT REFERENCES users(id),
    updated_at     BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
    UNIQUE(technology_id, metric_key)
  )`,

  // Technology Tags
  `CREATE TABLE IF NOT EXISTS technology_tags (
    id             TEXT PRIMARY KEY,
    technology_id  TEXT NOT NULL REFERENCES technologies(id),
    tenant_id      TEXT NOT NULL,
    tag            TEXT NOT NULL,
    value          TEXT,
    created_by     TEXT REFERENCES users(id),
    created_at     BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
    UNIQUE(technology_id, tag)
  )`,

  // Landscape Assignments
  `CREATE TABLE IF NOT EXISTS assignments (
    id          TEXT PRIMARY KEY,
    tenant_id   TEXT NOT NULL REFERENCES tenants(id),
    project_id  TEXT NOT NULL,
    project_name TEXT,
    stage       TEXT NOT NULL,
    owner       TEXT,
    notes       TEXT,
    updated_at  BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
    updated_by  TEXT REFERENCES users(id),
    UNIQUE(tenant_id, project_id)
  )`,

  // Ingest Sources
  `CREATE TABLE IF NOT EXISTS ingest_sources (
    id           TEXT PRIMARY KEY,
    tenant_id    TEXT NOT NULL REFERENCES tenants(id),
    source_type  TEXT NOT NULL,
    label        TEXT NOT NULL,
    config       JSONB NOT NULL DEFAULT '{}',
    last_run_at  BIGINT,
    is_active    INTEGER DEFAULT 1,
    created_at   BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
  )`,

  // Ingest Jobs
  `CREATE TABLE IF NOT EXISTS ingest_jobs (
    id           TEXT PRIMARY KEY,
    tenant_id    TEXT NOT NULL,
    source_id    TEXT NOT NULL REFERENCES ingest_sources(id),
    status       TEXT DEFAULT 'queued',
    started_at   BIGINT,
    completed_at BIGINT,
    stats        TEXT,
    error_log    TEXT,
    triggered_by TEXT REFERENCES users(id)
  )`,

  // Proposals
  `CREATE TABLE IF NOT EXISTS proposals (
    id              TEXT PRIMARY KEY,
    tenant_id       TEXT NOT NULL REFERENCES tenants(id),
    type            TEXT NOT NULL,
    technology_id   TEXT REFERENCES technologies(id),
    technology_name TEXT,
    capability_id   TEXT REFERENCES capabilities(id),
    proposed_state  TEXT,
    justification   TEXT NOT NULL,
    evidence_links  TEXT,
    requestor_id    TEXT NOT NULL REFERENCES users(id),
    requestor_lob   TEXT,
    status          TEXT DEFAULT 'pending',
    reviewer_id     TEXT REFERENCES users(id),
    decision_notes  TEXT,
    decided_at      BIGINT,
    created_at      BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
    updated_at      BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
  )`,

  `CREATE TABLE IF NOT EXISTS proposal_feedback (
    id           TEXT PRIMARY KEY,
    proposal_id  TEXT NOT NULL REFERENCES proposals(id),
    author_id    TEXT NOT NULL REFERENCES users(id),
    comment      TEXT NOT NULL,
    status_set   TEXT,
    created_at   BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
  )`,

  // Audit Log
  `CREATE TABLE IF NOT EXISTS audit_log (
    id            TEXT PRIMARY KEY,
    tenant_id     TEXT NOT NULL REFERENCES tenants(id),
    entity_type   TEXT NOT NULL,
    entity_id     TEXT NOT NULL,
    action        TEXT NOT NULL,
    user_id       TEXT,
    username      TEXT,
    old_value     TEXT,
    new_value     TEXT,
    ip_address    TEXT,
    user_agent    TEXT,
    created_at    BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
  )`,

  // Capability Ownership
  `CREATE TABLE IF NOT EXISTS capability_ownership (
    capability_id TEXT NOT NULL REFERENCES capabilities(id),
    user_id       TEXT NOT NULL REFERENCES users(id),
    tenant_id     TEXT NOT NULL,
    assigned_at   BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
    PRIMARY KEY (capability_id, user_id)
  )`,

  // Capability Evaluators
  `CREATE TABLE IF NOT EXISTS capability_evaluators (
    capability_id TEXT NOT NULL REFERENCES capabilities(id),
    user_id       TEXT NOT NULL REFERENCES users(id),
    tenant_id     TEXT NOT NULL,
    assigned_at   BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
    PRIMARY KEY (capability_id, user_id)
  )`,

  // Indexes
  `CREATE INDEX IF NOT EXISTS idx_tech_tenant      ON technologies(tenant_id)`,
  `CREATE INDEX IF NOT EXISTS idx_cards_tenant     ON technology_cards(tenant_id, state)`,
  `CREATE INDEX IF NOT EXISTS idx_assignments_tenant ON assignments(tenant_id, stage)`,
  `CREATE INDEX IF NOT EXISTS idx_cap_owner_tenant ON capability_ownership(tenant_id, user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_cap_eval_tenant  ON capability_evaluators(tenant_id, user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_entity     ON audit_log(tenant_id, entity_type, entity_id)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_time       ON audit_log(tenant_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_exceptions_lob   ON lob_exceptions(tenant_id, lob, is_active)`,
];
