const mongoose = require("mongoose");

const { Schema } = mongoose;

const OfferSchema = new Schema({
  parentBidId: String,
  dealerId: String,
  dealerName: String,
  price: String,
  address: String,
  isAccepted: Boolean,
  isClosed: Boolean,
});

const BidSchema = new Schema({
  userId: String,
  name: String,
  manufacturer: String,
  car: String,
  color: String,
  model: String,
  vehicleId: String,
  financing: String,
  distance: Number,
  zip: Number,
  responses: [String],
  isClosed: Boolean,
  createdAt: Number,
});

BidSchema.methods.addOffer = function (offer) {
  this.responses = [...this.responses, offer];
};

BidSchema.methods.close = function () {
  this.isClosed = true;
};

OfferSchema.methods.close = function () {
  this.isClosed = true;
};

OfferSchema.methods.accept = function () {
  this.isAccepted = true;
};

OfferSchema.methods.update = function (name, price) {
  this.price = price;
};

mongoose.model("Offer", OfferSchema);
mongoose.model("Bid", BidSchema);
