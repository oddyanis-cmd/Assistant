const { Router } = require('express');
const { requireRole } = require('../../middleware/session');

// Every admin route requires STAFF or ADMIN; individual routes narrow to ADMIN where needed.
const router = Router();
router.use(requireRole('ADMIN', 'STAFF'));
router.use(require('./dashboard').router);
router.use(require('./products').router);
router.use(require('./orders').router);
router.use(require('./content').router);

module.exports = { router };
