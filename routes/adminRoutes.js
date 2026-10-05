const express = require("express");
const router = express.Router();
const {
  getStats,
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  updateBalance,
  updateReturns,
  updateInvestment,
  getAllWithdrawals,
  updateWithdrawalStatus,
  getAllInvestments,
} = require("../controllers/adminController");
const {
  getAllConversations,
  getThread,
  replyToUser,
  deleteMessageAdmin,
} = require("../controllers/messageController");

// NO auth — admin routes are open
router.get("/stats", getStats);

// Users
router.get("/users", getAllUsers);
router.post("/users", createUser);
router.get("/users/:id", getUserById);
router.put("/users/:id", updateUser);
router.delete("/users/:id", deleteUser);
router.patch("/users/:id/balance", updateBalance);
router.patch("/users/:id/returns", updateReturns);

// Investments
router.get("/investments", getAllInvestments);
router.patch("/investments/:id", updateInvestment);

// Withdrawals
router.get("/withdrawals", getAllWithdrawals);
router.put("/withdrawals/:id", updateWithdrawalStatus);

// Messages
router.get("/messages", getAllConversations);
router.get("/messages/:userId", getThread);
router.post("/messages/:userId/reply", replyToUser);
router.delete("/messages/:messageId", deleteMessageAdmin);

module.exports = router;
