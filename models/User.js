const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const bankAccountSchema = new mongoose.Schema({
  bankName:      { type: String, required: true },
  accountNumber: { type: String, required: true },
  accountName:   { type: String, required: true },
  routingNumber: { type: String },
  isDefault:     { type: Boolean, default: false },
}, { _id: true });

const userSchema = new mongoose.Schema(
  {
    firstName:   { type: String, required: true, trim: true },
    lastName:    { type: String, required: true, trim: true },
    email:       { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone:       { type: String, trim: true },
    password:    { type: String, required: true, minlength: 8, select: false },
    country:     { type: String, default: "United States" },
    city:        { type: String },
    dob:         { type: Date },
    occupation:  { type: String },
    bio:         { type: String },
    avatarUrl:   { type: String },

    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },

    status: {
      type: String,
      enum: ["Active", "Suspended", "Inactive"],
      default: "Active",
    },

    kyc: {
      status:       { type: String, enum: ["Pending", "Verified", "Rejected"], default: "Pending" },
      submittedAt:  { type: Date },
      reviewedAt:   { type: Date },
      notes:        { type: String },
    },

    // Email verification
    isEmailVerified: { type: Boolean, default: false },
    emailVerifyToken: { type: String, select: false },
    emailVerifyExpires: { type: Date, select: false },

    // Password reset
    resetPasswordToken:   { type: String, select: false },
    resetPasswordExpires: { type: Date,   select: false },

    // 2FA
    twoFactorEnabled: { type: Boolean, default: false },

    // Wallet
    walletBalance: { type: Number, default: 0, min: 0 },

    // Linked bank accounts
    bankAccounts: [bankAccountSchema],

    // Referral
    referralCode:   { type: String, unique: true, sparse: true },
    referredBy:     { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    referralBonus:  { type: Number, default: 0 },

    lastLoginAt: { type: Date },
    lastLoginIp: { type: String },
  },
  { timestamps: true }
);

// ── Virtuals ────────────────────────────────────────────────────────────────
userSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// ── Pre-save: hash password ─────────────────────────────────────────────────
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// ── Methods ─────────────────────────────────────────────────────────────────
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toSafeObject = function () {
  const obj = this.toObject({ virtuals: true });
  delete obj.password;
  delete obj.resetPasswordToken;
  delete obj.resetPasswordExpires;
  delete obj.emailVerifyToken;
  delete obj.emailVerifyExpires;
  return obj;
};

module.exports = mongoose.model("User", userSchema);
