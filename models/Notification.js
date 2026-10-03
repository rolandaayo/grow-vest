const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    title:    { type: String, required: true },
    body:     { type: String, required: true },
    category: {
      type: String,
      enum: ["Returns", "Deposit", "Withdrawal", "Security", "System", "KYC", "Referral"],
      default: "System",
    },

    icon: { type: String, default: "📣" },

    isRead: { type: Boolean, default: false },
    readAt:  { type: Date },

    // Link to a relevant entity (optional)
    link: { type: String },

    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });

// Helper: mark as read
notificationSchema.methods.markRead = async function () {
  this.isRead = true;
  this.readAt = new Date();
  return this.save();
};

module.exports = mongoose.model("Notification", notificationSchema);
