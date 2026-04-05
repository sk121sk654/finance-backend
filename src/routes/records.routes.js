const router   = require('express').Router()
const { body } = require('express-validator')
const { getRecords, getRecordById, createRecord, updateRecord, deleteRecord } = require('../controllers/records.controller')
const { authenticate, requireRole } = require('../middlewares/auth.middleware')
const { validateRequest }           = require('../middlewares/error.middleware')
const CATS = ['salary','freelance','investment','food','transport','housing','entertainment','health','education','other']
const validation = [
  body('amount').isFloat({ min:0.01 }).withMessage('Amount must be positive'),
  body('type').isIn(['income','expense']).withMessage('Type must be income or expense'),
  body('category').isIn(CATS).withMessage('Invalid category'),
  body('date').optional().isISO8601().withMessage('Invalid date'),
  body('notes').optional().isLength({ max:500 }).withMessage('Max 500 chars'),
]
router.use(authenticate)
router.get('/',       getRecords)
router.get('/:id',    getRecordById)
router.post('/',      requireRole('admin'), validation, validateRequest, createRecord)
router.put('/:id',    requireRole('admin'), validation, validateRequest, updateRecord)
router.delete('/:id', requireRole('admin'), deleteRecord)
module.exports = router