require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env"),
});
const mongoose = require("mongoose");
const User = require("../models/User");
const Investment = require("../models/Investment");
const Transaction = require("../models/Transaction");
const Notification = require("../models/Notification");
const Withdrawal = require("../models/Withdrawal");

const URI = process.env.MONGO_URI;
if (!URI || URI.includes("<cluster-host>")) {
  console.error("❌  MONGO_URI not set. Check server/.env");
  process.exit(1);
}

const USERS = [
  {
    firstName: "John",
    lastName: "Doe",
    email: "john@growvest.com",
    phone: "+1 (212) 555-0198",
    city: "New York",
    wallet: 5430,
    kyc: "Verified",
    planName: "Growth",
    invested: 15000,
    returns: 2700,
  },
  {
    firstName: "Ashley",
    lastName: "Monroe",
    email: "ashley@growvest.com",
    phone: "+1 (310) 555-0174",
    city: "Los Angeles",
    wallet: 12800,
    kyc: "Verified",
    planName: "Premium",
    invested: 40000,
    returns: 9600,
  },
  {
    firstName: "Derek",
    lastName: "Sullivan",
    email: "derek@growvest.com",
    phone: "+1 (512) 555-0182",
    city: "Austin",
    wallet: 2100,
    kyc: "Pending",
    planName: "Starter",
    invested: 5000,
    returns: 540,
  },
  {
    firstName: "Priya",
    lastName: "Sharma",
    email: "priya@growvest.com",
    phone: "+1 (650) 555-0155",
    city: "San Francisco",
    wallet: 18500,
    kyc: "Verified",
    planName: "Premium",
    invested: 60000,
    returns: 14400,
  },
  {
    firstName: "Marcus",
    lastName: "Webb",
    email: "marcus@growvest.com",
    phone: "+1 (404) 555-0167",
    city: "Atlanta",
    wallet: 3200,
    kyc: "Pending",
    planName: "Starter",
    invested: 3000,
    returns: 290,
  },
  {
    firstName: "Sofia",
    lastName: "Reyes",
    email: "sofia@growvest.com",
    phone: "+1 (786) 555-0129",
    city: "Miami",
    wallet: 9600,
    kyc: "Verified",
    planName: "Growth",
    invested: 18000,
    returns: 3240,
  },
  {
    firstName: "Tyler",
    lastName: "Brooks",
    email: "tyler@growvest.com",
    phone: "+1 (713) 555-0141",
    city: "Houston",
    wallet: 500,
    kyc: "Rejected",
    planName: "Starter",
    invested: 1000,
    returns: 72,
    status: "Inactive",
  },
  {
    firstName: "Lauren",
    lastName: "Hayes",
    email: "lauren@growvest.com",
    phone: "+1 (312) 555-0193",
    city: "Chicago",
    wallet: 7800,
    kyc: "Verified",
    planName: "Growth",
    invested: 22000,
    returns: 4180,
  },
  {
    firstName: "James",
    lastName: "Carter",
    email: "james@growvest.com",
    phone: "+1 (202) 555-0116",
    city: "Washington DC",
    wallet: 1200,
    kyc: "Pending",
    planName: "Starter",
    invested: 2000,
    returns: 168,
  },
  {
    firstName: "Nina",
    lastName: "Patel",
    email: "nina@growvest.com",
    phone: "+1 (415) 555-0103",
    city: "Seattle",
    wallet: 31000,
    kyc: "Verified",
    planName: "Premium",
    invested: 80000,
    returns: 22400,
  },
];

async function seed() {
  const conn = await mongoose.connect(URI, {
    serverSelectionTimeoutMS: 15000,
    socketTimeoutMS: 60000,
  });
  console.log("✅  Connected:", conn.connection.host);

  // Clear everything
  await User.deleteMany({});
  await Investment.deleteMany({});
  await Transaction.deleteMany({});
  await Notification.deleteMany({});
  await Withdrawal.deleteMany({});
  console.log("🗑   Cleared all collections");

  // Admin
  await User.create({
    firstName: "Admin",
    lastName: "User",
    email: "admin@growvestinc.com",
    password: "Admin@123456",
    role: "admin",
    status: "Active",
    kyc: { status: "Verified" },
    walletBalance: 0,
    referralCode: "GVADMIN001",
    isEmailVerified: true,
  });
  console.log("👑  Admin: admin@growvestinc.com / Admin@123456");

  // Seed each user one at a time
  let i = 0;
  for (const u of USERS) {
    i++;
    const cfg = Investment.planConfig[u.planName];

    const user = await User.create({
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      phone: u.phone,
      country: "United States",
      city: u.city,
      password: "User@123456",
      walletBalance: u.wallet,
      kyc: { status: u.kyc },
      status: u.status || "Active",
      isEmailVerified: true,
      referralCode: `GV${u.firstName.slice(0, 4).toUpperCase()}${String(i).padStart(3, "0")}`,
    });

    const inv = await Investment.create({
      user: user._id,
      planName: u.planName,
      amountInvested: u.invested,
      roiRate: cfg.roiDefault,
      duration: cfg.duration,
      allocation: cfg.allocation,
      returnsEarned: u.returns,
      totalValue: u.invested + u.returns,
      progressPct: Math.floor(40 + Math.random() * 55),
      status: "Active",
    });

    await Transaction.insertMany([
      {
        user: user._id,
        investment: inv._id,
        type: "Deposit",
        amount: u.invested,
        description: "Bank Transfer · Chase Bank",
        status: "Completed",
        balanceAfter: u.invested,
      },
      {
        user: user._id,
        investment: inv._id,
        type: "Investment",
        amount: u.invested,
        description: `${u.planName} Plan Activation`,
        status: "Completed",
        balanceAfter: 0,
      },
      {
        user: user._id,
        investment: inv._id,
        type: "Return",
        amount: parseFloat((u.returns * 0.3).toFixed(2)),
        description: `${u.planName} Plan · Daily ROI`,
        status: "Completed",
        balanceAfter: u.wallet,
      },
    ]);

    await Notification.insertMany([
      {
        user: user._id,
        title: "Welcome to Grow Vest Inc.! 🎉",
        body: `Hi ${u.firstName}, your account is ready.`,
        category: "System",
        icon: "🎉",
      },
      {
        user: user._id,
        title: "Daily Returns Credited 📈",
        body: `Your ${u.planName} plan earned returns today.`,
        category: "Returns",
        icon: "📈",
      },
    ]);

    console.log(
      `  [${i}/10] ${u.firstName} ${u.lastName} | $${u.wallet} | ${u.planName} | KYC:${u.kyc}`,
    );
  }

  console.log("\n══════════════════════════════════════════");
  console.log("✅  SEED COMPLETE — 1 admin + 10 users");
  console.log("══════════════════════════════════════════");
  console.log("Admin:  admin@growvestinc.com / Admin@123456");
  console.log("Users:  *@growvest.com        / User@123456");
  console.log("══════════════════════════════════════════\n");
  process.exit(0);
}

seed().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
