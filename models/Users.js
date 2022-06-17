const mongoose = require("mongoose");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const { Schema } = mongoose;

const UsersSchema = new Schema({
  email: String,
  hash: String,
  salt: String,
  role: String,
  createdAt: Number,
  manufacturers: [String],
  name: String,
  zip: String,
  address: String,
  bids: [String],
  googleId: String,
  facebookId: String,
  notificationsType: String,
  unreadLiveBids: [String],
  lastSeenMessages: { type: Object, default: {} },
});

UsersSchema.methods.setPassword = function (password) {
  this.salt = crypto.randomBytes(16).toString("hex");
  this.hash = crypto
    .pbkdf2Sync(password, this.salt, 10000, 512, "sha512")
    .toString("hex");
};

UsersSchema.methods.validatePassword = function (password) {
  const hash = crypto
    .pbkdf2Sync(password, this.salt, 10000, 512, "sha512")
    .toString("hex");
  return this.hash === hash;
};

UsersSchema.methods.setNotificationsType = function (type) {
  return (this.notificationsType = type);
};

UsersSchema.methods.linkBid = function (newBidId) {
  this.bids = [...this.bids, newBidId];
};

UsersSchema.methods.markAsUnread = function (id) {
  this.unreadLiveBids = [...this.unreadLiveBids, id];
};

UsersSchema.methods.markAsRead = function (id) {
  this.unreadLiveBids = this.unreadLiveBids.filter((item) => item !== id);
};

UsersSchema.methods.generateJWT = function () {
  const today = new Date();
  const expirationDate = new Date(today);
  expirationDate.setDate(today.getDate() + 60);

  return jwt.sign(
    {
      id: this._id,
      email: this.email,
      role: this.role,
      exp: parseInt(expirationDate.getTime() / 1000, 10),
    },
    "dealtest-secret"
  );
};

UsersSchema.methods.toAuthJSON = function () {
  return {
    id: this._id,
    email: this.email,
    role: this.role,
    token: this.generateJWT(),
  };
};

mongoose.model("Users", UsersSchema);
