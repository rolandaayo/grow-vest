const Transaction = require("../models/Transaction");
const User = require("../models/User");

// ── GET /api/transactions ────────────────────────────────────────────────────
exports.getMyTransactions = async (req, res, next) => {
  try {
    const { type, status, limit = 20, page = 1 } = req.query;

    const filter = { user: req.user.id };
    if (type)   filter.type   = type;
    if (status) filter.status = status;

    const skip = (Number(page) - 1) * Number(limit);
    const [transactions, total] = await Promise.all([
      Transaction.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate("investment", "planName"),
      Transaction.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
      transactions,
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/transactions/:id ────────────────────────────────────────────────
exports.getTransactionById = async (req, res, next) => {
  try {
    const txn = await Transaction.findOne({
      _id: req.params.id,
      user: req.user.id,
    }).populate("investment", "planName");

    if (!txn) {
      return res.status(404).json({ success: false, message: "Transaction not found" });
    }
    res.status(200).json({ success: true, transaction: txn });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/transactions/deposit ──────────────────────────────────────────
exports.deposit = async (req, res, next) => {
  try {
    const { amount, paymentMethod, bankName } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: "Valid amount is required" });
    }

    const user = await User.findById(req.user.id);
    user.walletBalance += Number(amount);
    await user.save({ validateBeforeSave: false });

    const txn = await Transaction.create({
      user: req.user.id,
      type: "Deposit",
      amount,
      description: paymentMethod || "Bank Transfer",
      paymentMethod,
      bankName,
      balanceAfter: user.walletBalance,
    });

    res.status(201).json({ success: true, transaction: txn, walletBalance: user.walletBalance });
  } catch (err) {
    next(err);
  }
};
