const FinancialRecord = require('../models/FinancialRecord')
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
module.exports = { getSummary, getTrends, getByCategory, getRecent }