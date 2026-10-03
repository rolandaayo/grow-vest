const express = require("express");
const router = express.Router();
const {
  getNotifications,
  markOneRead,
  markAllRead,
  deleteNotification,
} = require("../controllers/notificationController");
const { protect } = require("../middleware/auth");

router.use(protect);
router.get("/",             getNotifications);
router.put("/read-all",     markAllRead);
router.put("/:id/read",     markOneRead);
router.delete("/:id",       deleteNotification);

module.exports = router;
