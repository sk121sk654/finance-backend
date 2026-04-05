const router   = require('express').Router()
const { body } = require('express-validator')
const { register, login, getMe } = require('../controllers/auth.controller')
const { authenticate }    = require('../middlewares/auth.middleware')
const { validateRequest } = require('../middlewares/error.middleware')
router.post('/register',
  [ body('name').trim().notEmpty().withMessage('Name required').isLength({ min:2 }).withMessage('Min 2 chars'),
    body('email').isEmail().withMessage('Valid email required').normalizeEmail(),
    body('password').isLength({ min:6 }).withMessage('Min 6 characters'),
    body('role').optional().isIn(['viewer','analyst','admin']).withMessage('Invalid role') ],
  validateRequest, register)
router.post('/login',
  [ body('email').isEmail().withMessage('Valid email required').normalizeEmail(),
    body('password').notEmpty().withMessage('Password required') ],
  validateRequest, login)
router.get('/me', authenticate, getMe)
module.exports = router