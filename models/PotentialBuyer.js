const mongoose = require("mongoose");

const { Schema } = mongoose;

const PotentialBuyerSchema = new Schema({
  userId: String,
  zip: Number,
  manufacturer: String,
  offerId: String,
});

mongoose.model("PotentialBuyer", PotentialBuyerSchema);
