const Investment = require("../models/Investment");
const Transaction = require("../models/Transaction");
const Notification = require("../models/Notification");
const User = require("../models/User");

// ── GET /api/investments/plans ───────────────────────────────────────────────
exports.getPlans = (req, res) => {
  res.status(200).json({ success: true, plans: Investment.planConfig });
};

// ── GET /api/investments ─────────────────────────────────────────────────────
exports.getMyInvestments = async (req, res, next) => {
  try {
    const { status } = req.query;
    const filter = { user: req.user.id };
    if (status) filter.status = status;

    const investments = await Investment.find(filter).sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: investments.length, investments });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/investments/:id ─────────────────────────────────────────────────
exports.getInvestmentById = async (req, res, next) => {
  try {
    const investment = await Investment.findOne({
      _id: req.params.id,
      user: req.user.id,
    });
    if (!investment) {
      return res.status(404).json({ success: false, message: "Investment not found" });
    }
    res.status(200).json({ success: true, investment });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/investments ────────────────────────────────────────────────────
exports.createInvestment = async (req, res, next) => {
  try {
    const { planName, amountInvested } = req.body;

    const config = Investment.planConfig[planName];
    if (!config) {
      return res.status(400).json({ success: false, message: "Invalid plan name" });
    }
    if (amountInvested < config.minAmount) {
      return res.status(400).json({
        success: false,
        message: `Minimum investment for ${planName} plan is $${config.minAmount}`,
      });
    }

    // Check wallet balance
    const user = await User.findById(req.user.id);
    if (user.walletBalance < amountInvested) {
      return res.status(400).json({ success: false, message: "Insufficient wallet balance" });
    }

    // Deduct from wallet
    user.walletBalance -= amountInvested;
    await user.save({ validateBeforeSave: false });

    // Create investment
    const investment = await Investment.create({
      user: req.user.id,
      planName,
      amountInvested,
      roiRate: config.roiDefault,
      duration: config.duration,
      allocation: config.allocation,
    });

    // Record transaction
    await Transaction.create({
      user: req.user.id,
      investment: investment._id,
      type: "Investment",
      amount: amountInvested,
      description: `${planName} Plan Activation`,
      balanceAfter: user.walletBalance,
    });

    // Notify
    await Notification.create({
      user: req.user.id,
      title: `${planName} Plan Activated 🚀`,
      body: `Your $${amountInvested.toLocaleString()} ${planName} investment is now live. Daily returns start immediately.`,
      category: "System",
      icon: "📈",
    });

    res.status(201).json({ success: true, investment });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/investments/:id/credit-return (internal / cron) ────────────────
exports.creditDailyReturn = async (req, res, next) => {
  try {
    const investment = await Investment.findById(req.params.id);
    if (!investment || investment.status !== "Active") {
      return res.status(404).json({ success: false, message: "Active investment not found" });
    }

    const user = await User.findById(investment.user);
    const daily = investment.dailyReturn;

    // Credit returns
    investment.returnsEarned += daily;
    investment.totalValue = investment.amountInvested + investment.returnsEarned;
    investment.lastReturnCreditedAt = new Date();

    // Update progress
    const elapsed = Date.now() - investment.startDate.getTime();
    const total = investment.maturityDate.getTime() - investment.startDate.getTime();
    investment.progressPct = Math.min(100, Math.round((elapsed / total) * 100));

    // Check maturity
    if (new Date() >= investment.maturityDate) {
      investment.status = "Completed";
      user.walletBalance += investment.totalValue;
      await Notification.create({
        user: user._id,
        title: "Investment Matured! 🎉",
        body: `Your ${investment.planName} plan has matured. $${investment.totalValue.toFixed(2)} has been added to your wallet.`,
        category: "Returns",
        icon: "💰",
      });
    } else {
      user.walletBalance += daily;
    }

    await Promise.all([investment.save(), user.save({ validateBeforeSave: false })]);

    // Log transaction
    await Transaction.create({
      user: investment.user,
      investment: investment._id,
      type: "Return",
      amount: daily,
      description: `${investment.planName} Plan · Daily ROI`,
      balanceAfter: user.walletBalance,
    });

    res.status(200).json({ success: true, dailyCredited: daily, investment });
  } catch (err) {
    next(err);
  }
};

// ── DELETE /api/investments/:id (cancel — admin or before first credit) ───────
exports.cancelInvestment = async (req, res, next) => {
  try {
    const investment = await Investment.findOne({ _id: req.params.id, user: req.user.id });
    if (!investment) {
      return res.status(404).json({ success: false, message: "Investment not found" });
    }
    if (investment.status !== "Active") {
      return res.status(400).json({ success: false, message: "Only active investments can be cancelled" });
    }

    investment.status = "Cancelled";
    await investment.save();

    // Refund principal
    const user = await User.findById(req.user.id);
    user.walletBalance += investment.amountInvested;
    await user.save({ validateBeforeSave: false });

    res.status(200).json({ success: true, message: "Investment cancelled and principal refunded" });
  } catch (err) {
    next(err);
  }
};
