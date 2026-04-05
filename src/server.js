require("dotenv").config();
const app = require("./app");
const connectDB = require("./config/db");

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();

  app.listen(PORT, () => {
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`🚀 FinanceOS API running on port ${PORT}`);
    console.log(`📍 Health: http://localhost:${PORT}/health`);
    console.log(`🌍 Mode:   ${process.env.NODE_ENV}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  });

  // Handle unhandled promise rejections
  process.on("unhandledRejection", (err) => {
    console.error("❌ Unhandled Rejection:", err.message);
    process.exit(1);
  });
};

startServer();
