const User = require("../models/User");
const Investment = require("../models/Investment");
const Transaction = require("../models/Transaction");
const Withdrawal = require("../models/Withdrawal");
const Notification = require("../models/Notification");

// ── GET /api/admin/stats ─────────────────────────────────────────────────────
exports.getStats = async (req, res, next) => {
  try {
    const [
      totalUsers,
      activeUsers,
      suspendedUsers,
      pendingKyc,
      totalInvestments,
      activeInvestments,
      allInvestments,
      pendingWithdrawals,
      totalWithdrawals,
    ] = await Promise.all([
      User.countDocuments({ role: "user" }),
      User.countDocuments({ role: "user", status: "Active" }),
      User.countDocuments({ role: "user", status: "Suspended" }),
      User.countDocuments({ "kyc.status": "Pending" }),
      Investment.countDocuments(),
      Investment.countDocuments({ status: "Active" }),
      Investment.find().select("amountInvested returnsEarned"),
      Withdrawal.countDocuments({ status: "Pending" }),
      Withdrawal.find({ status: "Completed" }).select("amount"),
    ]);

    const totalAUM = allInvestments.reduce((s, i) => s + i.amountInvested, 0);
    const totalReturnsPaid = allInvestments.reduce(
      (s, i) => s + i.returnsEarned,
      0,
    );
    const totalWithdrawn = totalWithdrawals.reduce((s, w) => s + w.amount, 0);

    res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        activeUsers,
        suspendedUsers,
        pendingKyc,
        totalInvestments,
        activeInvestments,
        totalAUM,
        totalReturnsPaid,
        pendingWithdrawals,
        totalWithdrawn,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/admin/users ─────────────────────────────────────────────────────
exports.getAllUsers = async (req, res, next) => {
  try {
    const { search, status, kyc, limit = 20, page = 1 } = req.query;
    const filter = { role: "user" };

    if (status) filter.status = status;
    if (kyc) filter["kyc.status"] = kyc;
    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [users, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      User.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
      users: users.map((u) => u.toSafeObject()),
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/admin/users/:id ──────────────────────────────────────────────────
exports.getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    const [investments, transactions, withdrawals] = await Promise.all([
      Investment.find({ user: user._id }).sort({ createdAt: -1 }),
      Transaction.find({ user: user._id }).sort({ createdAt: -1 }).limit(10),
      Withdrawal.find({ user: user._id }).sort({ createdAt: -1 }).limit(10),
    ]);

    res.status(200).json({
      success: true,
      user: user.toSafeObject(),
      investments,
      transactions,
      withdrawals,
    });
  } catch (err) {
    next(err);
  }
};

// ── PUT /api/admin/users/:id ──────────────────────────────────────────────────
exports.updateUser = async (req, res, next) => {
  try {
    const allowed = ["status", "kyc", "role", "walletBalance"];
    const updates = {};
    allowed.forEach((f) => {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    });

    const user = await User.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    // Notify user of status change
    if (updates.status) {
      await Notification.create({
        user: user._id,
        title: "Account Status Updated",
        body: `Your account status has been updated to: ${updates.status}. Contact support if you have questions.`,
        category: "Security",
        icon: "🔔",
      });
    }

    res.status(200).json({ success: true, user: user.toSafeObject() });
  } catch (err) {
    next(err);
  }
};

// ── DELETE /api/admin/users/:id ───────────────────────────────────────────────
exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    // Clean up related data
    await Promise.all([
      Investment.deleteMany({ user: req.params.id }),
      Transaction.deleteMany({ user: req.params.id }),
      Withdrawal.deleteMany({ user: req.params.id }),
      Notification.deleteMany({ user: req.params.id }),
    ]);

    res
      .status(200)
      .json({ success: true, message: "User and all associated data deleted" });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/admin/withdrawals ────────────────────────────────────────────────
exports.getAllWithdrawals = async (req, res, next) => {
  try {
    const { status, limit = 20, page = 1 } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const skip = (Number(page) - 1) * Number(limit);
    const [withdrawals, total] = await Promise.all([
      Withdrawal.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate("user", "firstName lastName email"),
      Withdrawal.countDocuments(filter),
    ]);

    res
      .status(200)
      .json({ success: true, total, page: Number(page), withdrawals });
  } catch (err) {
    next(err);
  }
};

// ── PUT /api/admin/withdrawals/:id ────────────────────────────────────────────
exports.updateWithdrawalStatus = async (req, res, next) => {
  try {
    const { status, adminNote } = req.body;
    const withdrawal = await Withdrawal.findById(req.params.id).populate(
      "user",
    );
    if (!withdrawal)
      return res
        .status(404)
        .json({ success: false, message: "Withdrawal not found" });

    const prevStatus = withdrawal.status;
    withdrawal.status = status;
    if (adminNote) withdrawal.adminNote = adminNote;
    if (status === "Processing") withdrawal.processedAt = new Date();
    if (status === "Completed") withdrawal.completedAt = new Date();

    // If admin rejects — refund
    if (status === "Failed" && prevStatus === "Pending") {
      const user = await User.findById(withdrawal.user._id);
      user.walletBalance += withdrawal.amount;
      await user.save({ validateBeforeSave: false });
    }

    await withdrawal.save();

    await Notification.create({
      user: withdrawal.user._id,
      title: `Withdrawal ${status}`,
      body: `Your withdrawal of $${withdrawal.amount.toLocaleString()} has been marked as ${status}.`,
      category: "Withdrawal",
      icon: status === "Completed" ? "✅" : "🔔",
    });

    res.status(200).json({ success: true, withdrawal });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/admin/users ─────────────────────────────────────────────────────
exports.createUser = async (req, res, next) => {
  try {
    const {
      firstName,
      lastName,
      email,
      password,
      phone,
      country,
      city,
      walletBalance,
      role,
      kyc,
    } = req.body;
    const exists = await User.findOne({ email });
    if (exists)
      return res
        .status(409)
        .json({ success: false, message: "Email already registered" });

    const crypto = require("crypto");
    const user = await User.create({
      firstName,
      lastName,
      email,
      password: password || "User@123456",
      phone,
      country: country || "United States",
      city,
      walletBalance: walletBalance || 0,
      role: role || "user",
      status: "Active",
      kyc: { status: kyc || "Pending" },
      isEmailVerified: true,
      referralCode: `GV${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
    });

    await Notification.create({
      user: user._id,
      title: "Welcome to Grow Vest Inc.! 🎉",
      body: `Hi ${firstName}, your account has been created by an administrator.`,
      category: "System",
      icon: "🎉",
    });

    res.status(201).json({ success: true, user: user.toSafeObject() });
  } catch (err) {
    next(err);
  }
};

// ── PATCH /api/admin/users/:id/balance ────────────────────────────────────────
exports.updateBalance = async (req, res, next) => {
  try {
    const { walletBalance, note, operation } = req.body;

    if (walletBalance === undefined || walletBalance < 0) {
      return res.status(400).json({
        success: false,
        message: "Valid walletBalance is required (>= 0)",
      });
    }

    const user = await User.findById(req.params.id);
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    const prev = user.walletBalance;
    let newBalance;

    if (operation === "add") {
      newBalance = prev + Number(walletBalance);
    } else if (operation === "subtract") {
      newBalance = Math.max(0, prev - Number(walletBalance));
    } else {
      // default: set absolute value
      newBalance = Number(walletBalance);
    }

    user.walletBalance = newBalance;
    await user.save({ validateBeforeSave: false });

    // Log as a transaction so it shows in user's history
    const txType = newBalance > prev ? "Deposit" : "Withdrawal";
    const diff = Math.abs(newBalance - prev);
    if (diff > 0) {
      await Transaction.create({
        user: user._id,
        type: txType,
        amount: diff,
        description: note || `Admin balance adjustment`,
        status: "Completed",
        balanceAfter: newBalance,
      });

      await Notification.create({
        user: user._id,
        title: newBalance > prev ? "Balance Credited 💰" : "Balance Adjusted",
        body:
          note ||
          `Your wallet balance has been updated to $${newBalance.toLocaleString()} by admin.`,
        category: "Deposit",
        icon: newBalance > prev ? "💰" : "🔔",
      });
    }

    res.status(200).json({
      success: true,
      user: user.toSafeObject(),
      previousBalance: prev,
      newBalance,
      difference: diff,
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/admin/investments ────────────────────────────────────────────────
exports.getAllInvestments = async (req, res, next) => {
  try {
    const { status, planName, limit = 20, page = 1 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (planName) filter.planName = planName;

    const skip = (Number(page) - 1) * Number(limit);
    const [investments, total] = await Promise.all([
      Investment.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate("user", "firstName lastName email"),
      Investment.countDocuments(filter),
    ]);

    res
      .status(200)
      .json({ success: true, total, page: Number(page), investments });
  } catch (err) {
    next(err);
  }
};

// ── PATCH /api/admin/users/:id/returns ───────────────────────────────────────
// Update a user's total returns across all their investments
exports.updateReturns = async (req, res, next) => {
  try {
    const { returnsEarned, note } = req.body;
    if (returnsEarned === undefined || Number(returnsEarned) < 0) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Valid returnsEarned value is required",
        });
    }

    const user = await User.findById(req.params.id);
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    // Distribute returns across active investments proportionally
    const investments = await Investment.find({
      user: req.params.id,
      status: "Active",
    });
    const totalNew = Number(returnsEarned);

    if (investments.length > 0) {
      const totalInvested = investments.reduce(
        (s, i) => s + i.amountInvested,
        0,
      );
      for (const inv of investments) {
        const share =
          totalInvested > 0
            ? inv.amountInvested / totalInvested
            : 1 / investments.length;
        inv.returnsEarned = parseFloat((totalNew * share).toFixed(2));
        inv.totalValue = inv.amountInvested + inv.returnsEarned;
        await inv.save();
      }
    }

    // Also credit the wallet
    user.walletBalance = parseFloat((user.walletBalance + totalNew).toFixed(2));
    await user.save({ validateBeforeSave: false });

    // Notify user
    await Notification.create({
      user: user._id,
      title: "Returns Updated 💰",
      body:
        note ||
        `Your investment returns have been updated to $${totalNew.toLocaleString()}.`,
      category: "Returns",
      icon: "💰",
    });

    // Log as transaction
    await Transaction.create({
      user: user._id,
      type: "Return",
      amount: totalNew,
      description: note || "Admin returns adjustment",
      status: "Completed",
      balanceAfter: user.walletBalance,
    });

    res.status(200).json({
      success: true,
      user: user.toSafeObject(),
      returnsEarned: totalNew,
    });
  } catch (err) {
    next(err);
  }
};

// ── PATCH /api/admin/investments/:id ─────────────────────────────────────────
// Edit an investment plan (roiRate, amountInvested, status, planName)
exports.updateInvestment = async (req, res, next) => {
  try {
    const allowed = [
      "planName",
      "amountInvested",
      "roiRate",
      "returnsEarned",
      "totalValue",
      "progressPct",
      "status",
    ];
    const updates = {};
    allowed.forEach((f) => {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    });

    const inv = await Investment.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    }).populate("user", "firstName lastName email");
    if (!inv)
      return res
        .status(404)
        .json({ success: false, message: "Investment not found" });

    res.status(200).json({ success: true, investment: inv });
  } catch (err) {
    next(err);
  }
};
