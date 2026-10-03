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
    const totalReturnsPaid = allInvestments.reduce((s, i) => s + i.returnsEarned, 0);
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
    if (kyc)    filter["kyc.status"] = kyc;
    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName:  { $regex: search, $options: "i" } },
        { email:     { $regex: search, $options: "i" } },
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
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

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
    allowed.forEach((f) => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    const user = await User.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

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
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    // Clean up related data
    await Promise.all([
      Investment.deleteMany({ user: req.params.id }),
      Transaction.deleteMany({ user: req.params.id }),
      Withdrawal.deleteMany({ user: req.params.id }),
      Notification.deleteMany({ user: req.params.id }),
    ]);

    res.status(200).json({ success: true, message: "User and all associated data deleted" });
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

    res.status(200).json({ success: true, total, page: Number(page), withdrawals });
  } catch (err) {
    next(err);
  }
};

// ── PUT /api/admin/withdrawals/:id ────────────────────────────────────────────
exports.updateWithdrawalStatus = async (req, res, next) => {
  try {
    const { status, adminNote } = req.body;
    const withdrawal = await Withdrawal.findById(req.params.id).populate("user");
    if (!withdrawal) return res.status(404).json({ success: false, message: "Withdrawal not found" });

    const prevStatus = withdrawal.status;
    withdrawal.status = status;
    if (adminNote) withdrawal.adminNote = adminNote;
    if (status === "Processing") withdrawal.processedAt = new Date();
    if (status === "Completed")  withdrawal.completedAt = new Date();

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

// ── GET /api/admin/investments ────────────────────────────────────────────────
exports.getAllInvestments = async (req, res, next) => {
  try {
    const { status, planName, limit = 20, page = 1 } = req.query;
    const filter = {};
    if (status)   filter.status   = status;
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

    res.status(200).json({ success: true, total, page: Number(page), investments });
  } catch (err) {
    next(err);
  }
};
