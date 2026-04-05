const FinancialRecord = require('../models/FinancialRecord')
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
module.exports = { getRecords, getRecordById, createRecord, updateRecord, deleteRecord }