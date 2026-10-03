const Message = require("../models/Message");
const Notification = require("../models/Notification");

// ─── USER: Send a new message to admin ───────────────────────────────────────
// POST /api/messages
exports.sendMessage = async (req, res, next) => {
  try {
    const { subject, body } = req.body;
    if (!body?.trim()) {
      return res.status(400).json({ success: false, message: "Message body is required" });
    }

    const message = await Message.create({
      user: req.user.id,
      senderRole: "user",
      subject: subject?.trim() || "Support Request",
      body: body.trim(),
    });

    res.status(201).json({ success: true, message });
  } catch (err) { next(err); }
};

// ─── USER: Get my messages (full thread view) ─────────────────────────────────
// GET /api/messages
exports.getMyMessages = async (req, res, next) => {
  try {
    const messages = await Message.find({
      user: req.user.id,
      deletedByUser: false,
    }).sort({ createdAt: 1 });

    // Mark unread admin messages as read
    await Message.updateMany(
      { user: req.user.id, senderRole: "admin", isRead: false },
      { isRead: true, readAt: new Date() }
    );

    res.status(200).json({ success: true, messages });
  } catch (err) { next(err); }
};

// ─── USER: Delete a message ───────────────────────────────────────────────────
// DELETE /api/messages/:id
exports.deleteMyMessage = async (req, res, next) => {
  try {
    const msg = await Message.findOne({ _id: req.params.id, user: req.user.id });
    if (!msg) return res.status(404).json({ success: false, message: "Message not found" });

    msg.deletedByUser = true;
    await msg.save();

    res.status(200).json({ success: true, message: "Message deleted" });
  } catch (err) { next(err); }
};

// ─── ADMIN: Get all conversations (latest message per user) ──────────────────
// GET /api/admin/messages
exports.getAllConversations = async (req, res, next) => {
  try {
    // Get the latest message per user, not deleted by admin
    const conversations = await Message.aggregate([
      { $match: { deletedByAdmin: false } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$user",
          lastMessage:  { $first: "$$ROOT" },
          totalMessages: { $sum: 1 },
          unreadCount:   { $sum: { $cond: [{ $and: [{ $eq: ["$senderRole","user"] }, { $eq: ["$isRead", false] }] }, 1, 0] } },
        },
      },
      { $sort: { "lastMessage.createdAt": -1 } },
    ]);

    // Populate user info
    await Message.populate(conversations, {
      path: "_id",
      model: "User",
      select: "firstName lastName email walletBalance status",
    });

    res.status(200).json({ success: true, conversations });
  } catch (err) { next(err); }
};

// ─── ADMIN: Get full thread for a specific user ───────────────────────────────
// GET /api/admin/messages/:userId
exports.getThread = async (req, res, next) => {
  try {
    const messages = await Message.find({
      user: req.params.userId,
      deletedByAdmin: false,
    }).sort({ createdAt: 1 });

    // Mark unread user messages as read now admin has seen them
    await Message.updateMany(
      { user: req.params.userId, senderRole: "user", isRead: false },
      { isRead: true, readAt: new Date() }
    );

    res.status(200).json({ success: true, messages });
  } catch (err) { next(err); }
};

// ─── ADMIN: Reply to a user ───────────────────────────────────────────────────
// POST /api/admin/messages/:userId/reply
exports.replyToUser = async (req, res, next) => {
  try {
    const { body, subject } = req.body;
    if (!body?.trim()) {
      return res.status(400).json({ success: false, message: "Reply body is required" });
    }

    // Find the latest user message in the thread to use as parent
    const parent = await Message.findOne({
      user: req.params.userId,
      senderRole: "user",
    }).sort({ createdAt: -1 });

    const reply = await Message.create({
      user:          req.params.userId,
      senderRole:    "admin",
      subject:       subject?.trim() || parent?.subject || "Support Reply",
      body:          body.trim(),
      parentMessage: parent?._id || null,
    });

    // Notify the user
    await Notification.create({
      user:     req.params.userId,
      title:    "New message from support 💬",
      body:     body.length > 80 ? body.slice(0, 80) + "…" : body,
      category: "System",
      icon:     "💬",
    });

    res.status(201).json({ success: true, message: reply });
  } catch (err) { next(err); }
};

// ─── ADMIN: Delete a message ──────────────────────────────────────────────────
// DELETE /api/admin/messages/:messageId
exports.deleteMessageAdmin = async (req, res, next) => {
  try {
    const msg = await Message.findById(req.params.messageId);
    if (!msg) return res.status(404).json({ success: false, message: "Message not found" });

    msg.deletedByAdmin = true;
    await msg.save();

    res.status(200).json({ success: true, message: "Message deleted" });
  } catch (err) { next(err); }
};
