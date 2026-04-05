const router = require('express').Router()
const { getSummary, getTrends, getByCategory, getRecent } = require('../controllers/dashboard.controller')
const { authenticate } = require('../middlewares/auth.middleware')
router.use(authenticate)
router.get('/summary',     getSummary)
router.get('/trends',      getTrends)
router.get('/by-category', getByCategory)
router.get('/recent',      getRecent)
module.exports = router