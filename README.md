# FinanceOS — Backend API

A RESTful backend for a Finance Dashboard with role-based access control, built with Node.js, Express, and MongoDB.

---

## Tech Stack

| Layer       | Technology                        |
|-------------|-----------------------------------|
| Runtime     | Node.js                           |
| Framework   | Express.js                        |
| Database    | MongoDB + Mongoose                |
| Auth        | JWT (jsonwebtoken)                |
| Validation  | express-validator                 |
| Security    | bcryptjs, express-rate-limit, cors|

---

## Project Structure

```
src/
├── config/
│   └── db.js                  # MongoDB connection
├── controllers/
│   ├── auth.controller.js     # Register, Login, Me
│   ├── records.controller.js  # Financial records CRUD
│   ├── dashboard.controller.js# Aggregation & summaries
│   └── users.controller.js    # User management (admin)
├── middlewares/
│   ├── auth.middleware.js     # JWT verify + requireRole()
│   └── error.middleware.js    # Global error handler
├── models/
│   ├── User.js                # User schema
│   └── FinancialRecord.js     # Record schema (soft delete)
├── routes/
│   ├── auth.routes.js
│   ├── records.routes.js
│   ├── dashboard.routes.js
│   └── users.routes.js
├── utils/
│   └── seed.js                # Demo data seeder
├── app.js                     # Express app setup
└── server.js                  # Entry point
```

---

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env with your MongoDB URI and JWT secret
```

### 3. Start MongoDB
Make sure MongoDB is running locally on port 27017, or update `MONGO_URI` in `.env`.

### 4. Seed demo data
```bash
npm run seed
```

### 5. Start server
```bash
npm run dev      # development (with nodemon)
npm start        # production
```

Server runs on `http://localhost:5000`

---

## Demo Accounts

| Role    | Email              | Password |
|---------|--------------------|----------|
| Admin   | admin@demo.com     | pass123  |
| Analyst | analyst@demo.com   | pass123  |
| Viewer  | viewer@demo.com    | pass123  |

---

## API Reference

### Auth

| Method | Endpoint             | Access | Description        |
|--------|----------------------|--------|--------------------|
| POST   | /api/auth/register   | Public | Create account     |
| POST   | /api/auth/login      | Public | Login + get token  |
| GET    | /api/auth/me         | All    | Get current user   |

**Login request:**
```json
POST /api/auth/login
{
  "email": "admin@demo.com",
  "password": "pass123"
}
```
**Response:**
```json
{
  "success": true,
  "token": "eyJhbGci...",
  "user": { "_id": "...", "name": "Admin User", "role": "admin" }
}
```

---

### Financial Records

| Method | Endpoint          | Access        | Description              |
|--------|-------------------|---------------|--------------------------|
| GET    | /api/records      | All roles     | List records (paginated) |
| GET    | /api/records/:id  | All roles     | Get single record        |
| POST   | /api/records      | Admin only    | Create record            |
| PUT    | /api/records/:id  | Admin only    | Update record            |
| DELETE | /api/records/:id  | Admin only    | Soft delete record       |

**Query params for GET /api/records:**
```
?page=1&limit=10
?type=income
?category=salary
?search=freelance
?from=2024-01-01&to=2024-12-31
?sortBy=date&sortOrder=desc
```

**Create record:**
```json
POST /api/records
Authorization: Bearer <token>
{
  "amount": 50000,
  "type": "income",
  "category": "salary",
  "date": "2024-03-01",
  "notes": "March salary"
}
```

---

### Dashboard

| Method | Endpoint                    | Access    | Description              |
|--------|-----------------------------|-----------|--------------------------|
| GET    | /api/dashboard/summary      | All roles | Total income/expense/balance + % change |
| GET    | /api/dashboard/trends       | All roles | Monthly trends (6 months)|
| GET    | /api/dashboard/by-category  | All roles | Category-wise totals     |
| GET    | /api/dashboard/recent       | All roles | Last 10 transactions     |

**Summary response:**
```json
{
  "totalIncome": 350000,
  "totalExpense": 180000,
  "netBalance": 170000,
  "incomeChange": 12,
  "expenseChange": -5,
  "balanceChange": 20,
  "byCategory": [...]
}
```

---

### Users (Admin only)

| Method | Endpoint               | Access     | Description          |
|--------|------------------------|------------|----------------------|
| GET    | /api/users             | Admin only | List all users       |
| PATCH  | /api/users/:id/role    | Admin only | Change user role     |
| PATCH  | /api/users/:id/status  | Admin only | Toggle active/inactive|
| DELETE | /api/users/:id         | Admin only | Delete user          |

---

## Role Permissions

| Action                 | Viewer | Analyst | Admin |
|------------------------|:------:|:-------:|:-----:|
| View records           | ✅     | ✅      | ✅    |
| View dashboard         | ✅     | ✅      | ✅    |
| Create/Edit records    | ❌     | ❌      | ✅    |
| Delete records         | ❌     | ❌      | ✅    |
| Manage users           | ❌     | ❌      | ✅    |

---

## Design Decisions & Assumptions

1. **Soft delete** — Records are never permanently deleted; `isDeleted: true` flag is set. This preserves data integrity and audit trail.

2. **Role assignment on register** — For demo purposes, role can be set during registration. In production, new users would default to `viewer` and admin would assign roles.

3. **JWT stored client-side** — Token is stored in `localStorage` on the frontend. In a production system, `httpOnly` cookies would be more secure.

4. **Password hashing** — bcryptjs with salt rounds of 12 is used for password security.

5. **Rate limiting** — 100 requests per 15 minutes globally; 20 requests per 15 minutes on auth routes to prevent brute force.

6. **MongoDB indexes** — Indexes added on `type`, `category`, `date`, and `isDeleted` fields for faster query performance.

7. **Dashboard % change** — Monthly comparison is done between current month and previous month to show trend direction.