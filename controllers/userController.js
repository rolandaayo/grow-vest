const User = require("../models/User");
const Investment = require("../models/Investment");
const Transaction = require("../models/Transaction");
const Withdrawal = require("../models/Withdrawal");

// ── GET /api/users/profile ───────────────────────────────────────────────────
exports.getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    res.status(200).json({ success: true, user: user.toSafeObject() });
  } catch (err) {
    next(err);
  }
};

// ── PUT /api/users/profile ───────────────────────────────────────────────────
exports.updateProfile = async (req, res, next) => {
  try {
    const allowed = [
      "firstName",
      "lastName",
      "phone",
      "country",
      "city",
      "dob",
      "occupation",
      "bio",
      "avatarUrl",
    ];
    const updates = {};
    allowed.forEach((f) => {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    });

    const user = await User.findByIdAndUpdate(req.user.id, updates, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({ success: true, user: user.toSafeObject() });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/users/bank-accounts ─────────────────────────────────────────────
exports.getBankAccounts = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select("bankAccounts");
    res.status(200).json({ success: true, bankAccounts: user.bankAccounts });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/users/bank-accounts ────────────────────────────────────────────
exports.addBankAccount = async (req, res, next) => {
  try {
    const { bankName, accountNumber, accountName, routingNumber, isDefault } =
      req.body;
    const user = await User.findById(req.user.id);

    if (isDefault) {
      user.bankAccounts.forEach((b) => {
        b.isDefault = false;
      });
    }

    user.bankAccounts.push({
      bankName,
      accountNumber,
      accountName,
      routingNumber,
      isDefault: !!isDefault,
    });
    await user.save();

    res.status(201).json({ success: true, bankAccounts: user.bankAccounts });
  } catch (err) {
    next(err);
  }
};

// ── DELETE /api/users/bank-accounts/:accountId ───────────────────────────────
exports.removeBankAccount = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    user.bankAccounts = user.bankAccounts.filter(
      (b) => b._id.toString() !== req.params.accountId,
    );
    await user.save();
    res.status(200).json({ success: true, bankAccounts: user.bankAccounts });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/users/dashboard ─────────────────────────────────────────────────
exports.getDashboard = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const [investments, recentTxns, user] = await Promise.all([
      Investment.find({ user: userId, status: "Active" }),
      Transaction.find({ user: userId }).sort({ createdAt: -1 }).limit(5),
      User.findById(userId),
    ]);

    const calculatedTotalInvested = investments.reduce(
      (s, i) => s + i.amountInvested,
      0,
    );
    const totalInvested =
      user?.totalInvestedOverride ?? calculatedTotalInvested;
    const totalReturns = investments.reduce((s, i) => s + i.returnsEarned, 0);
    const portfolioValue = totalInvested + totalReturns;

    res.status(200).json({
      success: true,
      dashboard: {
        portfolioValue,
        totalInvested,
        totalReturns,
        activePlans: investments.length,
        walletBalance: req.user.walletBalance,
        portfolioGrowth: user?.portfolioGrowth || [
          12, 18, 25, 32, 40, 48, 55, 62, 68, 72, 76, 80, 84, 86, 88, 90, 93,
          100,
        ],
        portfolioGrowthValue: user?.portfolioGrowthValue ?? 0,
        pendingInvestment: user?.pendingInvestment || 0,
        investments,
        recentTransactions: recentTxns,
      },
    });
  } catch (err) {
    next(err);
  }
};
