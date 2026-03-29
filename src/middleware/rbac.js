'use strict';

const ROLE_HIERARCHY = {
  platform_admin:   100,
  tenant_admin:      80,
  tco:               60,
  technology_owner:  50,
  lob_admin:         40,
  evaluator:         30,
  proposer:          20,
  member:            10,
};

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session?.userId) return res.status(401).json({ error: 'Unauthorized' });
    const userRole = req.session.role;
    if (!roles.includes(userRole) && userRole !== 'platform_admin') {
      return res.status(403).json({ error: `Requires role: ${roles.join(' or ')}` });
    }
    next();
  };
}

function requireMinRole(minRole) {
  return (req, res, next) => {
    if (!req.session?.userId) return res.status(401).json({ error: 'Unauthorized' });
    const userLevel = ROLE_HIERARCHY[req.session.role] || 0;
    const minLevel = ROLE_HIERARCHY[minRole] || 0;
    if (userLevel < minLevel) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

module.exports = { requireRole, requireMinRole, ROLE_HIERARCHY };
