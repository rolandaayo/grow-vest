const mongoose = require("mongoose");

const withdrawalSchema = new mongoose.Schema(
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

    amount: { type: Number, required: true, min: 50 },
    fee:    { type: Number, default: 0 },
    payout: { type: Number }, // amount - fee

    bankName:      { type: String, required: true },
    accountNumber: { type: String, required: true },
    accountName:   { type: String, required: true },
    routingNumber: { type: String },

    reference: {
      type: String,
      unique: true,
      default: () => `WD-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    },

    status: {
      type: String,
      enum: ["Pending", "Processing", "Completed", "Failed", "Reversed"],
      default: "Pending",
    },

    requestedAt:  { type: Date, default: Date.now },
    processedAt:  { type: Date },
    completedAt:  { type: Date },

    adminNote: { type: String },

    // Linked transaction record
    transaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
    },
  },
  { timestamps: true }
);

withdrawalSchema.pre("save", function (next) {
  if (this.isNew) {
    this.payout = this.amount - this.fee;
  }
  next();
});

withdrawalSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("Withdrawal", withdrawalSchema);
