'use strict';
const db = require('../db/index');

/**
 * Resolves tenant from X-Tenant-ID header, subdomain, or session.
 * Attaches req.tenant to the request.
 */
async function resolveTenant(req, res, next) {
  const slugFromHeader = req.headers['x-tenant-id'];
  const slugFromSession = req.session?.tenantSlug;
  const host = req.hostname || '';
  const slugFromSubdomain = host.split('.')[0];
  const isLocalhost = !slugFromSubdomain || slugFromSubdomain === 'localhost' || slugFromSubdomain === 'www';

  // Fall back to 'default' tenant for local development
  const slug = slugFromHeader || slugFromSession || (isLocalhost ? null : slugFromSubdomain) || 'default';

  try {
    const result = await db.query(`SELECT * FROM tenants WHERE slug = $1 AND is_active = 1`, [slug]);
    const tenant = result.rows[0];
    if (!tenant) return res.status(404).json({ error: `Tenant '${slug}' not found` });
    req.tenant = tenant;
    next();
  } catch (err) {
    next(err);
  }
}

function requireTenantAccess(req, res, next) {
  if (!req.tenant) return res.status(400).json({ error: 'No tenant context' });
  if (!req.session?.userId) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

module.exports = { resolveTenant, requireTenantAccess };
