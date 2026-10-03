const express = require("express");
const router = express.Router();
const {
  getProfile,
  updateProfile,
  getBankAccounts,
  addBankAccount,
  removeBankAccount,
  getDashboard,
} = require("../controllers/userController");
const { protect } = require("../middleware/auth");

router.use(protect); // all user routes require auth

router.get("/profile",                      getProfile);
router.put("/profile",                      updateProfile);
router.get("/dashboard",                    getDashboard);
router.get("/bank-accounts",                getBankAccounts);
router.post("/bank-accounts",               addBankAccount);
router.delete("/bank-accounts/:accountId",  removeBankAccount);

module.exports = router;
