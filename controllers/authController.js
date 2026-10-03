const crypto = require("crypto");
const User = require("../models/User");
const Notification = require("../models/Notification");
const { sendToken, generateRandomToken } = require("../utils/generateToken");
const sendEmail = require("../utils/sendEmail");

// ── POST /api/auth/register ──────────────────────────────────────────────────
exports.register = async (req, res, next) => {
  try {
    const { firstName, lastName, email, phone, password, country, referralCode } = req.body;

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(409).json({ success: false, message: "Email already registered" });
    }

    // Handle referral
    let referredBy;
    if (referralCode) {
      const referrer = await User.findOne({ referralCode });
      if (referrer) referredBy = referrer._id;
    }

    // Generate unique referral code for new user
    const newReferralCode = `GV${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

    const user = await User.create({
      firstName,
      lastName,
      email,
      phone,
      password,
      country: country || "United States",
      referralCode: newReferralCode,
      referredBy,
    });

    // Welcome notification
    await Notification.create({
      user: user._id,
      title: "Welcome to Grow Vest Inc.! 🎉",
      body: `Hi ${firstName}, your account has been created. Start investing today to grow your wealth.`,
      category: "System",
      icon: "🎉",
    });

    sendToken(user, 201, res);
  } catch (err) {
    next(err);
  }
};

// ── POST /api/auth/login ─────────────────────────────────────────────────────
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required" });
    }

    const user = await User.findOne({ email }).select("+password");
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    if (user.status === "Suspended") {
      return res.status(403).json({ success: false, message: "Account suspended. Contact support." });
    }

    // Update last login
    user.lastLoginAt = new Date();
    user.lastLoginIp = req.ip;
    await user.save({ validateBeforeSave: false });

    // Security notification
    await Notification.create({
      user: user._id,
      title: "New Login Detected",
      body: `A new login was detected on ${new Date().toLocaleString()}. If this wasn't you, secure your account immediately.`,
      category: "Security",
      icon: "🔒",
    });

    sendToken(user, 200, res);
  } catch (err) {
    next(err);
  }
};

// ── POST /api/auth/logout ────────────────────────────────────────────────────
exports.logout = (req, res) => {
  res.cookie("token", "", { httpOnly: true, expires: new Date(0) });
  res.status(200).json({ success: true, message: "Logged out successfully" });
};

// ── POST /api/auth/forgot-password ──────────────────────────────────────────
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    // Always respond OK so we don't reveal if email exists
    if (!user) {
      return res.status(200).json({ success: true, message: "If that email is registered, a reset link has been sent." });
    }

    const rawToken = generateRandomToken();
    user.resetPasswordToken = crypto.createHash("sha256").update(rawToken).digest("hex");
    user.resetPasswordExpires = Date.now() + 15 * 60 * 1000; // 15 min
    await user.save({ validateBeforeSave: false });

    const resetUrl = `${process.env.CLIENT_URL}/forgot-password?token=${rawToken}`;

    await sendEmail({
      to: user.email,
      subject: "Grow Vest Inc. — Password Reset Request",
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:auto">
          <h2 style="color:#0A1628">Reset Your Password</h2>
          <p>Hi ${user.firstName},</p>
          <p>Click the button below to reset your password. This link expires in 15 minutes.</p>
          <a href="${resetUrl}" style="display:inline-block;margin:16px 0;padding:12px 28px;background:#00C853;color:white;border-radius:8px;text-decoration:none;font-weight:600">
            Reset Password
          </a>
          <p style="color:#888;font-size:13px">If you didn't request this, ignore this email.</p>
        </div>
      `,
    });

    res.status(200).json({ success: true, message: "If that email is registered, a reset link has been sent." });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/auth/reset-password ───────────────────────────────────────────
exports.resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    }).select("+resetPasswordToken +resetPasswordExpires");

    if (!user) {
      return res.status(400).json({ success: false, message: "Token is invalid or has expired" });
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    sendToken(user, 200, res);
  } catch (err) {
    next(err);
  }
};

// ── GET /api/auth/me ─────────────────────────────────────────────────────────
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    res.status(200).json({ success: true, user: user.toSafeObject() });
  } catch (err) {
    next(err);
  }
};

// ── PUT /api/auth/change-password ────────────────────────────────────────────
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id).select("+password");

    if (!(await user.comparePassword(currentPassword))) {
      return res.status(401).json({ success: false, message: "Current password is incorrect" });
    }

    user.password = newPassword;
    await user.save();

    sendToken(user, 200, res);
  } catch (err) {
    next(err);
  }
};
