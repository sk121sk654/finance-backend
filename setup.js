const fs = require("fs");
const path = require("path");

const files = {
  "src/config/db.js": `const mongoose = require('mongoose')
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI)
    console.log('✅ MongoDB connected: ' + conn.connection.host)
  } catch (error) {
    console.error('❌ MongoDB error: ' + error.message)
    process.exit(1)
  }
}
module.exports = connectDB`,

  "src/models/User.js": `const mongoose = require('mongoose')
const bcrypt   = require('bcryptjs')
const userSchema = new mongoose.Schema({
  name:     { type: String, required: true, trim: true },
  email:    { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, minlength: 6, select: false },
  role:     { type: String, enum: ['viewer','analyst','admin'], default: 'viewer' },
  status:   { type: String, enum: ['active','inactive'], default: 'active' },
}, { timestamps: true })
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next()
  this.password = await bcrypt.hash(this.password, 12)
  next()
})
userSchema.methods.comparePassword = async function(candidate) {
  return bcrypt.compare(candidate, this.password)
}
userSchema.methods.toJSON = function() {
  const obj = this.toObject()
  delete obj.password
  delete obj.__v
  return obj
}
module.exports = mongoose.model('User', userSchema)`,

  "src/models/FinancialRecord.js": `const mongoose = require('mongoose')
const schema = new mongoose.Schema({
  amount:    { type: Number, required: true, min: 0.01 },
  type:      { type: String, required: true, enum: ['income','expense'] },
  category:  { type: String, required: true, enum: ['salary','freelance','investment','food','transport','housing','entertainment','health','education','other'] },
  date:      { type: Date, default: Date.now },
  notes:     { type: String, trim: true, maxlength: 500 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
}, { timestamps: true })
schema.pre(/^find/, function(next) {
  if (!this.getOptions().withDeleted) this.where({ isDeleted: false })
  next()
})
module.exports = mongoose.model('FinancialRecord', schema)`,

  "src/middlewares/auth.middleware.js": `const jwt  = require('jsonwebtoken')
const User = require('../models/User')
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer '))
      return res.status(401).json({ success: false, message: 'No token provided.' })
    const token   = authHeader.split(' ')[1]
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const user    = await User.findById(decoded.id)
    if (!user) return res.status(401).json({ success: false, message: 'User not found.' })
    if (user.status === 'inactive') return res.status(403).json({ success: false, message: 'Account deactivated.' })
    req.user = user
    next()
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid token.' })
  }
}
const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role))
    return res.status(403).json({ success: false, message: 'Access denied. Required: ' + roles.join(' or ') })
  next()
}
module.exports = { authenticate, requireRole }`,

  "src/middlewares/error.middleware.js": `const { validationResult } = require('express-validator')
const validateRequest = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty())
    return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array().map(e => ({ field: e.path, message: e.msg })) })
  next()
}
const globalErrorHandler = (err, req, res, next) => {
  console.error('❌', err.message)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0]
    return res.status(400).json({ success: false, message: field + ' already exists.' })
  }
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => ({ field: e.path, message: e.message }))
    return res.status(400).json({ success: false, message: 'Validation failed', errors })
  }
  if (err.name === 'CastError') return res.status(400).json({ success: false, message: 'Invalid ' + err.path })
  res.status(err.statusCode || 500).json({ success: false, message: err.message || 'Internal server error' })
}
const notFoundHandler = (req, res) => {
  res.status(404).json({ success: false, message: 'Route ' + req.method + ' ' + req.originalUrl + ' not found' })
}
module.exports = { validateRequest, globalErrorHandler, notFoundHandler }`,

  "src/controllers/auth.controller.js": `const jwt  = require('jsonwebtoken')
const User = require('../models/User')
const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' })
const register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body
    const existing = await User.findOne({ email })
    if (existing) return res.status(400).json({ success: false, message: 'Email already registered.' })
    const user  = await User.create({ name, email, password, role: role || 'viewer' })
    const token = generateToken(user._id)
    res.status(201).json({ success: true, message: 'Account created.', token, user })
  } catch (err) { next(err) }
}
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body
    const user = await User.findOne({ email }).select('+password')
    if (!user) return res.status(401).json({ success: false, message: 'Invalid email or password.' })
    if (user.status === 'inactive') return res.status(403).json({ success: false, message: 'Account deactivated.' })
    const isMatch = await user.comparePassword(password)
    if (!isMatch) return res.status(401).json({ success: false, message: 'Invalid email or password.' })
    const token = generateToken(user._id)
    res.json({ success: true, message: 'Login successful.', token, user })
  } catch (err) { next(err) }
}
const getMe = async (req, res) => res.json({ success: true, user: req.user })
module.exports = { register, login, getMe }`,

  "src/controllers/records.controller.js": `const FinancialRecord = require('../models/FinancialRecord')
const getRecords = async (req, res, next) => {
  try {
    const { page=1, limit=10, type, category, search, from, to, sortBy='date', sortOrder='desc' } = req.query
    const filter = {}
    if (type)     filter.type     = type
    if (category) filter.category = category
    if (search)   filter.notes    = { $regex: search, $options: 'i' }
    if (from || to) {
      filter.date = {}
      if (from) filter.date.$gte = new Date(from)
      if (to)   filter.date.$lte = new Date(to)
    }
    const skip = (Number(page)-1) * Number(limit)
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 }
    const [records, total] = await Promise.all([
      FinancialRecord.find(filter).populate('createdBy','name email').sort(sort).skip(skip).limit(Number(limit)),
      FinancialRecord.countDocuments(filter)
    ])
    res.json({ success: true, total, page: Number(page), totalPages: Math.ceil(total/Number(limit)), records })
  } catch (err) { next(err) }
}
const getRecordById = async (req, res, next) => {
  try {
    const record = await FinancialRecord.findById(req.params.id).populate('createdBy','name email')
    if (!record) return res.status(404).json({ success: false, message: 'Record not found.' })
    res.json({ success: true, record })
  } catch (err) { next(err) }
}
const createRecord = async (req, res, next) => {
  try {
    const { amount, type, category, date, notes } = req.body
    const record = await FinancialRecord.create({ amount, type, category, date: date||new Date(), notes, createdBy: req.user._id })
    res.status(201).json({ success: true, message: 'Record created.', record })
  } catch (err) { next(err) }
}
const updateRecord = async (req, res, next) => {
  try {
    const { amount, type, category, date, notes } = req.body
    const record = await FinancialRecord.findByIdAndUpdate(req.params.id, { amount, type, category, date, notes }, { new: true, runValidators: true })
    if (!record) return res.status(404).json({ success: false, message: 'Record not found.' })
    res.json({ success: true, message: 'Record updated.', record })
  } catch (err) { next(err) }
}
const deleteRecord = async (req, res, next) => {
  try {
    const record = await FinancialRecord.findByIdAndUpdate(req.params.id, { isDeleted: true, deletedAt: new Date() }, { new: true })
    if (!record) return res.status(404).json({ success: false, message: 'Record not found.' })
    res.json({ success: true, message: 'Record deleted.' })
  } catch (err) { next(err) }
}
module.exports = { getRecords, getRecordById, createRecord, updateRecord, deleteRecord }`,

  "src/controllers/dashboard.controller.js": `const FinancialRecord = require('../models/FinancialRecord')
const getSummary = async (req, res, next) => {
  try {
    const now = new Date()
    const thisMonth    = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastMonth    = new Date(now.getFullYear(), now.getMonth()-1, 1)
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
    const totals = await FinancialRecord.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } }
    ])
    const incomeTotal  = totals.find(t => t._id==='income')?.total  || 0
    const expenseTotal = totals.find(t => t._id==='expense')?.total || 0
    const thisM = await FinancialRecord.aggregate([
      { $match: { isDeleted: false, date: { $gte: thisMonth } } },
      { $group: { _id: '$type', total: { $sum: '$amount' } } }
    ])
    const lastM = await FinancialRecord.aggregate([
      { $match: { isDeleted: false, date: { $gte: lastMonth, $lte: lastMonthEnd } } },
      { $group: { _id: '$type', total: { $sum: '$amount' } } }
    ])
    const thisMI = thisM.find(t=>t._id==='income')?.total  || 0
    const thisME = thisM.find(t=>t._id==='expense')?.total || 0
    const lastMI = lastM.find(t=>t._id==='income')?.total  || 0
    const lastME = lastM.find(t=>t._id==='expense')?.total || 0
    const pct = (c,p) => p===0 ? (c>0?100:0) : Math.round(((c-p)/p)*100)
    const byCategory = await FinancialRecord.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } }
    ])
    res.json({ success: true, totalIncome: incomeTotal, totalExpense: expenseTotal,
      netBalance: incomeTotal-expenseTotal, incomeChange: pct(thisMI,lastMI),
      expenseChange: pct(thisME,lastME), balanceChange: pct(thisMI-thisME,lastMI-lastME), byCategory })
  } catch (err) { next(err) }
}
const getTrends = async (req, res, next) => {
  try {
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth()-5)
    sixMonthsAgo.setDate(1)
    sixMonthsAgo.setHours(0,0,0,0)
    const data = await FinancialRecord.aggregate([
      { $match: { isDeleted: false, date: { $gte: sixMonthsAgo } } },
      { $group: { _id: { year: { $year: '$date' }, month: { $month: '$date' }, type: '$type' }, total: { $sum: '$amount' } } },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ])
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    const grouped = {}
    data.forEach(({ _id, total }) => {
      const key = _id.year+'-'+_id.month
      if (!grouped[key]) grouped[key] = { month: months[_id.month-1], year: _id.year, income: 0, expense: 0 }
      grouped[key][_id.type] = total
    })
    res.json({ success: true, trends: Object.values(grouped) })
  } catch (err) { next(err) }
}
const getByCategory = async (req, res, next) => {
  try {
    const data = await FinancialRecord.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } }
    ])
    res.json({ success: true, data })
  } catch (err) { next(err) }
}
const getRecent = async (req, res, next) => {
  try {
    const records = await FinancialRecord.find().populate('createdBy','name').sort({ date: -1 }).limit(10)
    res.json({ success: true, data: records })
  } catch (err) { next(err) }
}
module.exports = { getSummary, getTrends, getByCategory, getRecent }`,

  "src/controllers/users.controller.js": `const User = require('../models/User')
const getAllUsers = async (req, res, next) => {
  try {
    const users = await User.find().sort({ createdAt: -1 })
    res.json({ success: true, total: users.length, users })
  } catch (err) { next(err) }
}
const updateRole = async (req, res, next) => {
  try {
    const { role } = req.body
    if (!['viewer','analyst','admin'].includes(role)) return res.status(400).json({ success: false, message: 'Invalid role.' })
    if (req.params.id === req.user._id.toString()) return res.status(400).json({ success: false, message: 'Cannot change your own role.' })
    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true })
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' })
    res.json({ success: true, message: 'Role updated to ' + role, user })
  } catch (err) { next(err) }
}
const updateStatus = async (req, res, next) => {
  try {
    const { status } = req.body
    if (!['active','inactive'].includes(status)) return res.status(400).json({ success: false, message: 'Invalid status.' })
    if (req.params.id === req.user._id.toString()) return res.status(400).json({ success: false, message: 'Cannot deactivate yourself.' })
    const user = await User.findByIdAndUpdate(req.params.id, { status }, { new: true })
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' })
    res.json({ success: true, message: 'Status updated to ' + status, user })
  } catch (err) { next(err) }
}
const deleteUser = async (req, res, next) => {
  try {
    if (req.params.id === req.user._id.toString()) return res.status(400).json({ success: false, message: 'Cannot delete yourself.' })
    const user = await User.findByIdAndDelete(req.params.id)
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' })
    res.json({ success: true, message: 'User deleted.' })
  } catch (err) { next(err) }
}
module.exports = { getAllUsers, updateRole, updateStatus, deleteUser }`,

  "src/routes/auth.routes.js": `const router   = require('express').Router()
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
module.exports = router`,

  "src/routes/records.routes.js": `const router   = require('express').Router()
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
module.exports = router`,

  "src/routes/dashboard.routes.js": `const router = require('express').Router()
const { getSummary, getTrends, getByCategory, getRecent } = require('../controllers/dashboard.controller')
const { authenticate } = require('../middlewares/auth.middleware')
router.use(authenticate)
router.get('/summary',     getSummary)
router.get('/trends',      getTrends)
router.get('/by-category', getByCategory)
router.get('/recent',      getRecent)
module.exports = router`,

  "src/routes/users.routes.js": `const router = require('express').Router()
const { getAllUsers, updateRole, updateStatus, deleteUser } = require('../controllers/users.controller')
const { authenticate, requireRole } = require('../middlewares/auth.middleware')
router.use(authenticate, requireRole('admin'))
router.get('/',             getAllUsers)
router.patch('/:id/role',   updateRole)
router.patch('/:id/status', updateStatus)
router.delete('/:id',       deleteUser)
module.exports = router`,

  "src/utils/seed.js": `require('dotenv').config()
const connectDB = require('../config/db')
const User = require('../models/User')
const FinancialRecord = require('../models/FinancialRecord')
const USERS = [
  { name: 'Admin User',   email: 'admin@demo.com',   password: 'pass123', role: 'admin'   },
  { name: 'Analyst User', email: 'analyst@demo.com', password: 'pass123', role: 'analyst' },
  { name: 'Viewer User',  email: 'viewer@demo.com',  password: 'pass123', role: 'viewer'  },
]
const generateRecords = (adminId) => {
  const records = []
  const now = new Date()
  const expCats = ['food','transport','housing','entertainment','health']
  const expAmts = { food:8000, transport:3000, housing:15000, entertainment:4000, health:2000 }
  for (let m=5; m>=0; m--) {
    const d = new Date(now.getFullYear(), now.getMonth()-m, 1)
    records.push({ amount: 50000+Math.floor(Math.random()*20000), type:'income', category:'salary', date: new Date(d.getFullYear(),d.getMonth(),1), notes:'Monthly salary', createdBy:adminId })
    if (Math.random()>0.4) records.push({ amount: Math.floor(Math.random()*15000)+5000, type:'income', category:'freelance', date: new Date(d.getFullYear(),d.getMonth(),10), notes:'Freelance payment', createdBy:adminId })
    expCats.forEach((cat,i) => {
      records.push({ amount: expAmts[cat]+Math.floor(Math.random()*2000)-1000, type:'expense', category:cat, date: new Date(d.getFullYear(),d.getMonth(),5+i*4), notes:cat+' expense', createdBy:adminId })
    })
  }
  return records
}
const seed = async () => {
  try {
    await connectDB()
    await User.deleteMany({})
    await FinancialRecord.deleteMany({})
    const users = await User.create(USERS)
    const admin = users.find(u => u.role==='admin')
    await FinancialRecord.create(generateRecords(admin._id))
    console.log('🎉 Seed complete!')
    console.log('Admin:   admin@demo.com / pass123')
    console.log('Analyst: analyst@demo.com / pass123')
    console.log('Viewer:  viewer@demo.com / pass123')
    process.exit(0)
  } catch (err) {
    console.error('❌ Seed failed:', err.message)
    process.exit(1)
  }
}
seed()`,
};

// Create all files
Object.entries(files).forEach(([filePath, content]) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
  console.log("✅ Created: " + filePath);
});

console.log("\n🎉 All files created!");
console.log("Now run:");
console.log("  npm run seed");
console.log("  npm run dev");
