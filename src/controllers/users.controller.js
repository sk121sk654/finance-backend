const User = require('../models/User')
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
module.exports = { getAllUsers, updateRole, updateStatus, deleteUser }