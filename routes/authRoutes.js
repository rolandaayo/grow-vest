const express = require("express");
const router = express.Router();
const {
  register,
  login,
  logout,
  forgotPassword,
  resetPassword,
  getMe,
  changePassword,
} = require("../controllers/authController");
const { protect } = require("../middleware/auth");

router.post("/register",         register);
router.post("/login",            login);
router.post("/logout",           logout);
router.post("/forgot-password",  forgotPassword);
router.post("/reset-password",   resetPassword);
router.get("/me",                protect, getMe);
router.put("/change-password",   protect, changePassword);

module.exports = router;
