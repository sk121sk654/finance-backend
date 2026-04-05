const { validationResult } = require('express-validator')
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
module.exports = { validateRequest, globalErrorHandler, notFoundHandler }