const jwt  = require('jsonwebtoken')
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
module.exports = { authenticate, requireRole }