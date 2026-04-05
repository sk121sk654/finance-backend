const jwt  = require('jsonwebtoken')
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
module.exports = { register, login, getMe }