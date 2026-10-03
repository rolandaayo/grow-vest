const express = require("express");
const router = express.Router();
const {
  getMyTransactions,
  getTransactionById,
  deposit,
} = require("../controllers/transactionController");
const { protect } = require("../middleware/auth");

router.use(protect);
router.get("/",          getMyTransactions);
router.get("/:id",       getTransactionById);
router.post("/deposit",  deposit);

module.exports = router;
