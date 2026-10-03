const mongoose = require("mongoose");

const investmentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    planName: {
      type: String,
      enum: ["Starter", "Growth", "Premium"],
      required: true,
    },

    amountInvested: { type: Number, required: true, min: 500 },
    returnsEarned:  { type: Number, default: 0 },
    totalValue:     { type: Number, default: 0 },

    roiRate: { type: Number, required: true }, // annual % e.g. 18
    dailyReturn: { type: Number, default: 0 }, // computed on create

    duration: { type: Number, required: true }, // months
    startDate: { type: Date, default: Date.now },
    maturityDate: { type: Date },

    progressPct: { type: Number, default: 0, min: 0, max: 100 },

    status: {
      type: String,
      enum: ["Active", "Completed", "Cancelled"],
      default: "Active",
    },

    // Asset allocation snapshot
    allocation: [
      {
        asset: String,
        percentage: Number,
      },
    ],

    lastReturnCreditedAt: { type: Date },
    notes: { type: String },
  },
  { timestamps: true }
);

// ── Compute maturity date and daily return before saving ────────────────────
investmentSchema.pre("save", function (next) {
  if (this.isNew) {
    const months = this.duration;
    const start = this.startDate || new Date();
    const maturity = new Date(start);
    maturity.setMonth(maturity.getMonth() + months);
    this.maturityDate = maturity;

    // Daily return = principal × (annualRate / 365)
    this.dailyReturn = parseFloat(
      ((this.amountInvested * (this.roiRate / 100)) / 365).toFixed(2)
    );

    this.totalValue = this.amountInvested;
  }
  next();
});

// ── Static: plan config ─────────────────────────────────────────────────────
investmentSchema.statics.planConfig = {
  Starter: {
    minAmount: 500,
    roiMin: 8,
    roiMax: 12,
    roiDefault: 10,
    duration: 3,
    allocation: [
      { asset: "Government Securities", percentage: 60 },
      { asset: "Money Market", percentage: 30 },
      { asset: "Cash", percentage: 10 },
    ],
  },
  Growth: {
    minAmount: 2500,
    roiMin: 14,
    roiMax: 20,
    roiDefault: 17,
    duration: 6,
    allocation: [
      { asset: "Equities (US & Global Markets)", percentage: 40 },
      { asset: "Fixed Income / Bonds", percentage: 30 },
      { asset: "REITs", percentage: 20 },
      { asset: "Cash & Equivalents", percentage: 10 },
    ],
  },
  Premium: {
    minAmount: 10000,
    roiMin: 22,
    roiMax: 35,
    roiDefault: 28,
    duration: 12,
    allocation: [
      { asset: "Real Estate", percentage: 35 },
      { asset: "Commodities", percentage: 25 },
      { asset: "High-Yield Bonds", percentage: 25 },
      { asset: "Private Equity", percentage: 15 },
    ],
  },
};

module.exports = mongoose.model("Investment", investmentSchema);
