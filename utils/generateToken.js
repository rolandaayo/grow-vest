const jwt = require("jsonwebtoken");
const crypto = require("crypto");

// Sign a JWT for a user id
const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

// Send token as JSON + httpOnly cookie
const sendToken = (user, statusCode, res) => {
  const token = signToken(user._id);

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  };

  res.cookie("token", token, cookieOptions);

  res.status(statusCode).json({
    success: true,
    token,
    user: user.toSafeObject(),
  });
};

// Generate a random hex token (for email verify / password reset)
const generateRandomToken = () => crypto.randomBytes(32).toString("hex");

module.exports = { signToken, sendToken, generateRandomToken };
