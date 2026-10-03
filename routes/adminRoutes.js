const express = require("express");
const router = express.Router();
const {
  getStats,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  getAllWithdrawals,
  updateWithdrawalStatus,
  getAllInvestments,
} = require("../controllers/adminController");
const { protect, adminOnly } = require("../middleware/auth");

router.use(protect, adminOnly); // every admin route requires auth + admin role

// Dashboard
router.get("/stats", getStats);

// Users
router.get("/users",         getAllUsers);
router.get("/users/:id",     getUserById);
router.put("/users/:id",     updateUser);
router.delete("/users/:id",  deleteUser);

// Withdrawals
router.get("/withdrawals",          getAllWithdrawals);
router.put("/withdrawals/:id",      updateWithdrawalStatus);

// Investments
router.get("/investments", getAllInvestments);

module.exports = router;
