const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    investment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Investment",
    },

    type: {
      type: String,
      enum: ["Deposit", "Withdrawal", "Return", "Investment", "Referral Bonus"],
      required: true,
    },

    amount: { type: Number, required: true }, // positive always
    fee:    { type: Number, default: 0 },

    description: { type: String, required: true },

    reference: {
      type: String,
      unique: true,
      default: () => `TXN-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    },

    status: {
      type: String,
      enum: ["Pending", "Completed", "Failed", "Reversed"],
      default: "Completed",
    },

    // For deposits / withdrawals
    paymentMethod: { type: String }, // e.g. "Bank Transfer · Chase Bank"
    bankName:      { type: String },
    accountLast4:  { type: String },

    // Balance snapshot after transaction
    balanceAfter: { type: Number },

    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

// Index for fast user transaction lookups
transactionSchema.index({ user: 1, createdAt: -1 });
transactionSchema.index({ reference: 1 }, { unique: true });

module.exports = mongoose.model("Transaction", transactionSchema);
