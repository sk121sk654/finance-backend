require('dotenv').config()
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
seed()