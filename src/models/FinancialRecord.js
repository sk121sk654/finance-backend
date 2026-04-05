const mongoose = require('mongoose')
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
module.exports = mongoose.model('FinancialRecord', schema)