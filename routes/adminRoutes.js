const express = require("express");
const router = express.Router();
const { protect, adminOnly } = require("../middleware/auth");
const {
  getStats,
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  updateBalance,
  updateDashboardMetrics,
  updateReturns,
  updateInvestment,
  updatePortfolioGrowth,
  updatePendingInvestment,
  getAllWithdrawals,
  updateWithdrawalStatus,
  updateWithdrawalDetails,
  updateDepositTransaction,
  getAllInvestments,
} = require("../controllers/adminController");
const {
  getAllConversations,
  getThread,
  replyToUser,
  deleteMessageAdmin,
} = require("../controllers/messageController");

router.use(protect, adminOnly);

router.get("/stats", getStats);

// Users
router.get("/users", getAllUsers);
router.post("/users", createUser);
router.get("/users/:id", getUserById);
router.put("/users/:id", updateUser);
router.delete("/users/:id", deleteUser);
router.patch("/users/:id/balance", updateBalance);
router.patch("/users/:id/dashboard-metrics", updateDashboardMetrics);
router.patch("/users/:id/returns", updateReturns);
router.patch("/users/:id/portfolio-growth", updatePortfolioGrowth);
router.patch("/users/:id/pending-investment", updatePendingInvestment);

// Investments
router.get("/investments", getAllInvestments);
router.patch("/investments/:id", updateInvestment);

// User transaction history
router.patch("/transactions/:id", updateDepositTransaction);

// Withdrawals
router.get("/withdrawals", getAllWithdrawals);
router.put("/withdrawals/:id", updateWithdrawalStatus);
router.patch("/withdrawals/:id", updateWithdrawalDetails);

// Messages
router.get("/messages", getAllConversations);
router.get("/messages/:userId", getThread);
router.post("/messages/:userId/reply", replyToUser);
router.delete("/messages/:messageId", deleteMessageAdmin);

module.exports = router;
