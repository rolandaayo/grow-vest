const express = require("express");
const router  = express.Router();
const {
  sendMessage,
  getMyMessages,
  deleteMyMessage,
} = require("../controllers/messageController");
const { protect } = require("../middleware/auth");

router.use(protect);

router.get("/",        getMyMessages);   // GET  /api/messages
router.post("/",       sendMessage);     // POST /api/messages
router.delete("/:id",  deleteMyMessage); // DELETE /api/messages/:id

module.exports = router;
