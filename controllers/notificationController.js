const Notification = require("../models/Notification");

// ── GET /api/notifications ───────────────────────────────────────────────────
exports.getNotifications = async (req, res, next) => {
  try {
    const { limit = 20, page = 1, unreadOnly } = req.query;
    const filter = { user: req.user.id };
    if (unreadOnly === "true") filter.isRead = false;

    const skip = (Number(page) - 1) * Number(limit);
    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      Notification.countDocuments(filter),
      Notification.countDocuments({ user: req.user.id, isRead: false }),
    ]);

    res.status(200).json({ success: true, total, unreadCount, page: Number(page), notifications });
  } catch (err) {
    next(err);
  }
};

// ── PUT /api/notifications/:id/read ─────────────────────────────────────────
exports.markOneRead = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { isRead: true, readAt: new Date() },
      { new: true }
    );
    if (!notification) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }
    res.status(200).json({ success: true, notification });
  } catch (err) {
    next(err);
  }
};

// ── PUT /api/notifications/read-all ─────────────────────────────────────────
exports.markAllRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { user: req.user.id, isRead: false },
      { isRead: true, readAt: new Date() }
    );
    res.status(200).json({ success: true, message: "All notifications marked as read" });
  } catch (err) {
    next(err);
  }
};

// ── DELETE /api/notifications/:id ────────────────────────────────────────────
exports.deleteNotification = async (req, res, next) => {
  try {
    await Notification.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    res.status(200).json({ success: true, message: "Notification deleted" });
  } catch (err) {
    next(err);
  }
};
