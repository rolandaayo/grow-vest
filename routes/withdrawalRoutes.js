const express = require("express");
const router = express.Router();
const {
  getMyWithdrawals,
  requestWithdrawal,
  getWithdrawalById,
} = require("../controllers/withdrawalController");
const { protect } = require("../middleware/auth");

router.use(protect);
router.get("/",     getMyWithdrawals);
router.post("/",    requestWithdrawal);
router.get("/:id",  getWithdrawalById);

module.exports = router;
