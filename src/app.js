const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const authRoutes = require("./routes/auth.routes");
const recordsRoutes = require("./routes/records.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const usersRoutes = require("./routes/users.routes");
const {
  globalErrorHandler,
  notFoundHandler,
} = require("./middlewares/error.middleware");

const app = express();

// ── CORS ──
app.use(
  cors({
    origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  }),
);

// ── Body parsers ──
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true }));

// ── Logger ──
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// ── Rate limiting ──
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 100,
//   message: {
//     success: false,
//     message: "Too many requests. Please try again after 15 minutes.",
//   },
//   standardHeaders: true,
//   legacyHeaders: false,
// });
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "development" ? 1000 : 100,
  message: {
    success: false,
    message: "Too many requests. Please try again after 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api", limiter);

// Stricter limit for auth routes
// const authLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 20,
//   message: {
//     success: false,
//     message: "Too many login attempts. Please try again after 15 minutes.",
//   },
// });
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "development" ? 500 : 20,
  message: {
    success: false,
    message: "Too many login attempts. Please try again after 15 minutes.",
  },
});
app.use("/api/auth", authLimiter);

// ── Health check ──
app.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "FinanceOS API is running",
    timestamp: new Date(),
  });
});

// ── API Routes ──
app.use("/api/auth", authRoutes);
app.use("/api/records", recordsRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/users", usersRoutes);

// ── 404 + Global error handler ──
app.use(notFoundHandler);
app.use(globalErrorHandler);

module.exports = app;
