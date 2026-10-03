const Withdrawal = require("../models/Withdrawal");
const Transaction = require("../models/Transaction");
const Notification = require("../models/Notification");
const User = require("../models/User");

// ── GET /api/withdrawals ─────────────────────────────────────────────────────
exports.getMyWithdrawals = async (req, res, next) => {
  try {
    const { status, limit = 20, page = 1 } = req.query;
    const filter = { user: req.user.id };
    if (status) filter.status = status;

    const skip = (Number(page) - 1) * Number(limit);
    const [withdrawals, total] = await Promise.all([
      Withdrawal.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      Withdrawal.countDocuments(filter),
    ]);

    res.status(200).json({ success: true, total, page: Number(page), pages: Math.ceil(total / limit), withdrawals });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/withdrawals ────────────────────────────────────────────────────
exports.requestWithdrawal = async (req, res, next) => {
  try {
    const { amount, bankName, accountNumber, accountName, routingNumber, investmentId } = req.body;

    if (!amount || amount < 50) {
      return res.status(400).json({ success: false, message: "Minimum withdrawal amount is $50" });
    }

    const user = await User.findById(req.user.id);
    if (user.walletBalance < amount) {
      return res.status(400).json({ success: false, message: "Insufficient wallet balance" });
    }

    // Reserve funds immediately
    user.walletBalance -= Number(amount);
    await user.save({ validateBeforeSave: false });

    const withdrawal = await Withdrawal.create({
      user: req.user.id,
      investment: investmentId || undefined,
      amount,
      bankName,
      accountNumber,
      accountName,
      routingNumber,
      status: "Pending",
    });

    // Log transaction
    const txn = await Transaction.create({
      user: req.user.id,
      type: "Withdrawal",
      amount,
      description: `Bank Transfer · ${bankName}`,
      bankName,
      accountLast4: accountNumber.slice(-4),
      balanceAfter: user.walletBalance,
      status: "Pending",
    });

    withdrawal.transaction = txn._id;
    await withdrawal.save();

    await Notification.create({
      user: req.user.id,
      title: "Withdrawal Requested",
      body: `Your withdrawal of $${amount.toLocaleString()} to ${bankName} is being processed. Funds arrive within 24 hours.`,
      category: "Withdrawal",
      icon: "🏦",
    });

    res.status(201).json({ success: true, withdrawal, walletBalance: user.walletBalance });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/withdrawals/:id ─────────────────────────────────────────────────
exports.getWithdrawalById = async (req, res, next) => {
  try {
    const withdrawal = await Withdrawal.findOne({ _id: req.params.id, user: req.user.id })
      .populate("transaction");

    if (!withdrawal) {
      return res.status(404).json({ success: false, message: "Withdrawal not found" });
    }
    res.status(200).json({ success: true, withdrawal });
  } catch (err) {
    next(err);
  }
};
