const express = require("express");
const router = express.Router();
const {
  getPlans,
  getMyInvestments,
  getInvestmentById,
  createInvestment,
  creditDailyReturn,
  cancelInvestment,
} = require("../controllers/investmentController");
const { protect, adminOnly } = require("../middleware/auth");

router.get("/plans", getPlans); // public

router.use(protect);
router.get("/",       getMyInvestments);
router.post("/",      createInvestment);
router.get("/:id",    getInvestmentById);
router.delete("/:id", cancelInvestment);

// Admin / cron only
router.post("/:id/credit-return", adminOnly, creditDailyReturn);

module.exports = router;
