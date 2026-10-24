const prisma = require('./prisma');

function audit(req, action, entity, entityId, meta) {
  return prisma.auditLog
    .create({ data: { userId: req.user?.id ?? null, action, entity, entityId, meta } })
    .catch((e) => console.error('audit log failed', e));
}

module.exports = { audit };
