const router = require('express').Router()
const { getAllUsers, updateRole, updateStatus, deleteUser } = require('../controllers/users.controller')
const { authenticate, requireRole } = require('../middlewares/auth.middleware')
router.use(authenticate, requireRole('admin'))
router.get('/',             getAllUsers)
router.patch('/:id/role',   updateRole)
router.patch('/:id/status', updateStatus)
router.delete('/:id',       deleteUser)
module.exports = router