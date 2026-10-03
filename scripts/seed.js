/**
 * Grow Vest Inc. — Database Seed Script
 * Run: node scripts/seed.js
 *
 * Seeds:
 *  - 1 admin user     → admin@growvestinc.com / Admin@123456
 *  - 3 regular users  → see USERS array below
 *  - 2 investments per user
 *  - Transactions for each
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const mongoose   = require("mongoose");
const bcrypt     = require("bcryptjs");
const User        = require("../models/User");
const Investment  = require("../models/Investment");
const Transaction = require("../models/Transaction");
const Notification = require("../models/Notification");

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI || MONGO_URI.includes("<cluster-host>")) {
  console.error("❌  MONGO_URI is not set or still has placeholder.");
  console.error("    Open server/.env and replace <cluster-host> with your Atlas cluster hostname.");
  console.error("    Example: cluster0.abc12.mongodb.net");
  process.exit(1);
}

// ─── Seed data ────────────────────────────────────────────────────────────────
const ADMIN = {
  firstName: "Admin",
  lastName:  "User",
  email:     "admin@growvestinc.com",
  password:  "Admin@123456",
  role:      "admin",
  status:    "Active",
  kyc:       { status: "Verified" },
  walletBalance: 0,
  referralCode: "GVADMIN001",
};

const USERS = [
  {
    firstName: "John",   lastName: "Doe",
    email: "john@growvest.com", password: "User@123456",
    country: "United States", city: "New York",
    phone: "+1 (212) 555-0198", walletBalance: 5430.00,
    referralCode: "GVJOHN001",
  },
  {
    firstName: "Ashley", lastName: "Monroe",
    email: "ashley@growvest.com", password: "User@123456",
    country: "United States", city: "Los Angeles",
    phone: "+1 (310) 555-0174", walletBalance: 12800.00,
    referralCode: "GVASH002",
  },
  {
    firstName: "Derek",  lastName: "Sullivan",
    email: "derek@growvest.com", password: "User@123456",
    country: "United States", city: "Austin",
    phone: "+1 (512) 555-0182", walletBalance: 2100.00,
    referralCode: "GVDER003",
  },
];

// ─── Main ─────────────────────────────────────────────────────────────────────
async function seed() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅  MongoDB connected:", mongoose.connection.host);

    // Wipe existing data
    await Promise.all([
      User.deleteMany({}),
      Investment.deleteMany({}),
      Transaction.deleteMany({}),
      Notification.deleteMany({}),
    ]);
    console.log("🗑   Cleared existing data");

    // ── Create admin ──────────────────────────────────────────────────────────
    const adminUser = await User.create(ADMIN);
    console.log(`👑  Admin created: ${ADMIN.email} / ${ADMIN.password}`);

    // ── Create regular users + their investments ──────────────────────────────
    for (const userData of USERS) {
      const user = await User.create({
        ...userData,
        kyc: { status: "Verified" },
        status: "Active",
        isEmailVerified: true,
      });

      // Growth investment
      const growthConfig = Investment.planConfig.Growth;
      const growthInv = await Investment.create({
        user:           user._id,
        planName:       "Growth",
        amountInvested: 5000,
        roiRate:        growthConfig.roiDefault,
        duration:       growthConfig.duration,
        allocation:     growthConfig.allocation,
        returnsEarned:  480,
        totalValue:     5480,
        progressPct:    55,
        status:         "Active",
      });

      // Starter investment
      const starterConfig = Investment.planConfig.Starter;
      const starterInv = await Investment.create({
        user:           user._id,
        planName:       "Starter",
        amountInvested: 1000,
        roiRate:        starterConfig.roiDefault,
        duration:       starterConfig.duration,
        allocation:     starterConfig.allocation,
        returnsEarned:  85,
        totalValue:     1085,
        progressPct:    80,
        status:         "Active",
      });

      // Transactions
      await Transaction.create([
        {
          user: user._id, investment: growthInv._id,
          type: "Deposit", amount: 5000,
          description: "Bank Transfer · Chase Bank",
          status: "Completed", balanceAfter: 5000,
        },
        {
          user: user._id, investment: growthInv._id,
          type: "Investment", amount: 5000,
          description: "Growth Plan Activation",
          status: "Completed", balanceAfter: 0,
        },
        {
          user: user._id, investment: growthInv._id,
          type: "Return", amount: 48.50,
          description: "Growth Plan · Daily ROI",
          status: "Completed", balanceAfter: 48.50,
        },
        {
          user: user._id, investment: starterInv._id,
          type: "Deposit", amount: 1000,
          description: "Bank Transfer · Bank of America",
          status: "Completed", balanceAfter: 1048.50,
        },
        {
          user: user._id, investment: starterInv._id,
          type: "Return", amount: 8.50,
          description: "Starter Plan · Daily ROI",
          status: "Completed", balanceAfter: 1057.00,
        },
      ]);

      // Welcome notification
      await Notification.create({
        user: user._id,
        title: "Welcome to Grow Vest Inc.! 🎉",
        body: `Hi ${user.firstName}, your account is ready. Start investing to grow your wealth.`,
        category: "System", icon: "🎉",
      });
      await Notification.create({
        user: user._id,
        title: "KYC Verification Complete ✅",
        body: "Your identity has been verified. You now have full access to all features.",
        category: "KYC", icon: "✅",
      });

      console.log(`👤  User created: ${userData.email} / ${userData.password}`);
      console.log(`    → Growth investment: $5,000 | Starter: $1,000 | Wallet: $${user.walletBalance}`);
    }

    console.log("\n═══════════════════════════════════════════════");
    console.log("✅  SEED COMPLETE");
    console.log("═══════════════════════════════════════════════");
    console.log("\n🔐  LOGIN CREDENTIALS:");
    console.log("─────────────────────────────────────────────");
    console.log(`Admin:   admin@growvestinc.com  /  Admin@123456`);
    USERS.forEach(u => {
      console.log(`User:    ${u.email}  /  User@123456`);
    });
    console.log("─────────────────────────────────────────────\n");

    process.exit(0);
  } catch (err) {
    console.error("❌  Seed error:", err.message);
    process.exit(1);
  }
}

seed();
