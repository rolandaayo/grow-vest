require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const connectDB = require("./config/db");
const errorHandler = require("./middleware/errorHandler");

// ─── Routes ───────────────────────────────────────────────────────────────────
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const investmentRoutes = require("./routes/investmentRoutes");
const transactionRoutes = require("./routes/transactionRoutes");
const withdrawalRoutes = require("./routes/withdrawalRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const adminRoutes = require("./routes/adminRoutes");

const app = express();

// ─── Allowed CORS origins ─────────────────────────────────────────────────────
const allowedOrigins = [
  "https://grow-vest-lemon.vercel.app", // Vercel frontend
  "https://growvestinc.web.app", // Firebase frontend
  "https://growvestinc.firebaseapp.com", // Firebase alt domain
  "http://localhost:3000",
  "http://localhost:3001",
];

const corsOptions = {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // curl / Postman / server-to-server
    const ok =
      allowedOrigins.includes(origin) ||
      /^https:\/\/grow-vest.*\.vercel\.app$/.test(origin);
    if (ok) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(helmet());
app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); // pre-flight

// ─── Rate limiting ────────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests. Try again later." },
});

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(globalLimiter);

// ─── Body parser ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== "production") app.use(morgan("dev"));

// ─── Health + debug (BEFORE DB middleware — always available) ─────────────────
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Grow Vest Inc. API is running",
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// Shows env var status — helps diagnose Vercel config issues
app.get("/api/debug-env", (req, res) => {
  const uri = process.env.MONGO_URI || "";
  res.status(200).json({
    MONGO_URI_SET: !!uri && !uri.includes("<cluster-host>"),
    MONGO_URI_PREVIEW: uri ? uri.substring(0, 35) + "..." : "NOT SET",
    JWT_SECRET_SET: !!process.env.JWT_SECRET,
    CLIENT_URL: process.env.CLIENT_URL || "NOT SET",
    NODE_ENV: process.env.NODE_ENV || "NOT SET",
  });
});

// ─── Lazy DB middleware ───────────────────────────────────────────────────────
// For Vercel serverless: connect on first request, reuse after
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error("DB connection failed:", err.message);
    return res.status(503).json({
      success: false,
      message: "Database unavailable. Please try again in a moment.",
      // Always show detail so you can diagnose from Vercel logs
      detail: err.message,
    });
  }
});

// ─── API routes ───────────────────────────────────────────────────────────────
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/investments", investmentRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/withdrawals", withdrawalRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/admin", adminRoutes);

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res
    .status(404)
    .json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// ─── Error handler ────────────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Local dev server ─────────────────────────────────────────────────────────
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () =>
    console.log(`🚀 Server running on port ${PORT} [${process.env.NODE_ENV}]`),
  );
}

module.exports = app;
