const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    // The user this conversation belongs to
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Who sent this specific message
    senderRole: {
      type: String,
      enum: ["user", "admin"],
      required: true,
    },

    subject: { type: String, default: "Support Request" },
    body:    { type: String, required: true, trim: true },

    // If this is a reply, link to the original/parent message
    parentMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },

    isRead: { type: Boolean, default: false },
    readAt: { type: Date },

    // Soft delete — messages are hidden not hard-deleted
    deletedByUser:  { type: Boolean, default: false },
    deletedByAdmin: { type: Boolean, default: false },
  },
  { timestamps: true }
);

messageSchema.index({ user: 1, createdAt: -1 });
messageSchema.index({ parentMessage: 1 });

module.exports = mongoose.model("Message", messageSchema);
