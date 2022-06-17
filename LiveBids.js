const mongoose = require("mongoose");
const app = require("./app");
const zipcodes = require("zipcodes");
const Users = mongoose.model("Users");
const Bid = mongoose.model("Bid");
const Offer = mongoose.model("Offer");
const PotentialBuyer = mongoose.model("PotentialBuyer");

const {
  USER_CONNECT,
  OFFER_REQUEST_CREATED,
  OFFER_CREATED,
  OFFER_ACCEPTED,
  OFFER_UPDATED,
  END_CAMPAIGN,
  REQUEST_OUT_THE_DOOR_PRICE,
  MARK_AS_READ,
  GET_LAST_SEEN_LIST,
  SET_LAST_SEEN,
  MESSAGE_SEND,
} = require("./Events");

let connectedUsers = [];

const sendMsg = (email, title, text) => {
  const SENDGRID_API_KEY =
    "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";
  const isProduction = process.env.NODE_ENV === "production";
  const link = isProduction
    ? "https://dealstryker.com"
    : "http://localhost:3000";

  const sgMail = require("@sendgrid/mail");
  sgMail.setApiKey(SENDGRID_API_KEY);
  const msg = {
    to: email,
    from: "dealtester@dealstryker.com",
    subject: title,
    html: `${text}\n <a href=${link}>${link}</a>`,
  };
  sgMail
    .send(msg)
    .then(() => console.log("email sended"))
    .catch((err) => console.log("email sending error"));
};

module.exports = function (socket) {
  console.log("Socket ID: " + socket.id);

  socket.on(USER_CONNECT, (userId, callback) => {
    let connectedUser = {};
    Users.findOne({ _id: userId }, (err, foundedUser) => {
      if (err) {
        console.log("Search in database error");
      }

      if (foundedUser) {
        connectedUser = {
          role: foundedUser.role,
          email: foundedUser.email,
          name: foundedUser.name,
          zip: foundedUser.zip,
          bids: foundedUser.bids,
          socketId: socket.id,
          id: userId,
        };

        connectedUsers.push(connectedUser);
        socket.user = connectedUser;
        socket.join(connectedUser.role);

        socket.on("disconnect", () => {
          const userIndexInArray = connectedUsers.findIndex(
            (foundedUser) => foundedUser.id === connectedUser.id
          );
          connectedUsers.splice(userIndexInArray, 1);
          console.log("user disconnected");
        });

        Bid.find(
          {
            _id: { $in: connectedUser.bids },
          },
          async function (err, docs) {
            let newReq = [];

            await Promise.all(
              docs.map(async (request) => {
                let offersArr = [...request.responses];
                await Offer.find(
                  {
                    _id: { $in: offersArr },
                  },
                  (err, offers) => {
                    if (connectedUser.role === "dealer")
                      newReq.push({
                        ...request._doc,
                        responses: offers.filter(
                          (offer) => offer.dealerId === connectedUser.id
                        ),
                      });
                    else newReq.push({ ...request._doc, responses: offers });
                  }
                );
              })
            );
            callback(newReq);
          }
        );
      } else console.log("User not founded");
    });
    console.log("user connected");
  });

  socket.on(OFFER_REQUEST_CREATED, (offerRequestData, callback) => {
    Users.findOne({ _id: offerRequestData.userId }, async (err, user) => {
      if (err) {
        console.log("Search in database error");
      }

      if (user) {
        let activeBids = [];

        await Bid.find(
          {
            _id: { $in: user.bids },
          },
          async function (err, docs) {
            if (!err && docs && docs.length) {
              activeBids = docs.filter((bid) => !bid.isClosed);
            }
          }
        );

        if (activeBids && activeBids.length < 3) {
          const currentDate = new Date();

          const numericalDistance = offerRequestData.distance
            ? Number(offerRequestData.distance.replace("mil", ""))
            : 30;

          let offerRequest = new Bid({
            userId: user._id,
            name: offerRequestData.name,
            manufacturer: offerRequestData.manufacturer,
            car: offerRequestData.car,
            color: offerRequestData.color,
            model: offerRequestData.model,
            vehicleId: offerRequestData.vehicleId,
            financing: offerRequestData.financing,
            distance: numericalDistance,
            zip: offerRequestData.zip,
            isClosed: false,
            createdAt: currentDate.getTime(),
          });
          offerRequest.save().then(() => {
            user.linkBid(offerRequest._id);
            user.save();
            Users.find({ role: "dealer" }, (error, result) => {
              if (error) {
                return console.log(`Error has occurred: ${error}`);
              }
              if (result && result.length) {
                const fitDealers = result.filter(
                  (dealer) =>
                    zipcodes.distance(dealer.zip, offerRequest.zip) <
                      offerRequest.distance &&
                    dealer.manufacturers.includes(offerRequestData.manufacturer)
                );
                if (fitDealers && fitDealers.length) {
                  fitDealers.forEach((fitDealer) => {
                    fitDealer.markAsUnread(offerRequest._id);
                    const fitNotificationsType = ["all", "offer"];
                    if (
                      fitNotificationsType.indexOf(
                        fitDealer.notificationsType
                      ) !== -1
                    )
                      sendMsg(
                        fitDealer.email,
                        "New offer request",
                        "You received new offer request."
                      );
                    fitDealer.linkBid(offerRequest._id);
                    fitDealer.save().then(() => {
                      const connectedDealer = connectedUsers.filter(
                        (connectedUser, i) => {
                          if (
                            connectedUser.id === fitDealer.id &&
                            connectedUsers[i]
                          ) {
                            connectedUsers[i].bids = [
                              ...connectedUsers[i].bids,
                              offerRequest._id.toString(),
                            ];
                          }
                          return connectedUser.id === fitDealer.id;
                        }
                      );
                      if (connectedDealer && connectedDealer.length)
                        connectedDealer.map((dealer) =>
                          app.ioLiveBids
                            .to(dealer.socketId)
                            .emit(OFFER_REQUEST_CREATED, offerRequest)
                        );
                    });
                  });
                } else {
                  const potentialBuyer = new PotentialBuyer({
                    userId: offerRequest.userId,
                    zip: offerRequest.zip,
                    manufacturer: offerRequest.manufacturer,
                    offerId: offerRequest._id,
                  });
                  potentialBuyer.save().then(() => callback(400));
                }
              }
            });
            callback(200, offerRequest);
          });
          console.log("offer request created");
        } else {
          callback(409);
        }
      } else {
        callback(401);
      }
    });
  });

  socket.on(OFFER_CREATED, (offerData, callback) => {
    Bid.findOne({ _id: offerData.requestId }, (err, foundedBid) => {
      Offer.findOne(
        { parentBidId: foundedBid._id, dealerId: socket.user.id },
        (err, foundedOffer) => {
          if (err) {
            console.log("Search in database error");
          }

          if (foundedOffer) {
            foundedOffer.update(offerData.price);
            foundedOffer.save().then(() => {
              if (foundedBid) {
                Users.findOne({ _id: foundedBid.userId }, (err, customer) => {
                  if (!err && customer) {
                    if (
                      customer.unreadLiveBids.indexOf(foundedOffer._id) === -1
                    ) {
                      customer.markAsUnread(foundedOffer._id);
                      const fitNotificationsType = ["all", "offer"];
                      if (
                        fitNotificationsType.indexOf(
                          customer.notificationsType
                        ) !== -1
                      )
                        sendMsg(
                          customer.email,
                          "Offer updated",
                          `${foundedBid.manufacturer} ${foundedBid.car} offer from ${socket.user.name} was updated.`
                        );
                      customer.save();
                    }
                  }
                });
              }
              const connectedCustomer = connectedUsers.filter(
                (connectedUser) => connectedUser.id === foundedBid.userId
              );
              if (connectedCustomer && connectedCustomer.length)
                connectedCustomer.map((customer) =>
                  app.ioLiveBids
                    .to(customer.socketId)
                    .emit(
                      OFFER_UPDATED,
                      offerData.requestId,
                      foundedOffer._id,
                      { price: offerData.price }
                    )
                );
              console.log(`offer ${foundedOffer._id} updated`);
              callback(201, foundedOffer);
            });
          } else {
            if (foundedBid) {
              let offer = new Offer({
                parentBidId: foundedBid._id,
                dealerId: offerData.dealerId,
                dealerName: socket.user.name,
                price: offerData.price,
              });
              offer.save().then(() => {
                foundedBid.addOffer(offer._id);
                foundedBid.save().then(() =>
                  Users.findOne({ _id: offerData.dealerId }, (err, user) => {
                    if (err) {
                      console.log("Search in database error");
                    }
                    if (foundedBid)
                      if (user) {
                        user.linkBid(foundedBid._id);
                        user.save();

                        Users.findOne(
                          { _id: foundedBid.userId },
                          (err, customer) => {
                            if (!err && customer) {
                              customer.markAsUnread(offer._id);
                              const fitNotificationsType = ["all", "offer"];
                              if (
                                fitNotificationsType.indexOf(
                                  customer.notificationsType
                                ) !== -1
                              )
                                sendMsg(
                                  customer.email,
                                  "New offer",
                                  "You received new offer."
                                );
                              customer.save();
                            }
                          }
                        );

                        const connectedCustomer = connectedUsers.filter(
                          (connectedUser) =>
                            connectedUser.id === foundedBid.userId
                        );
                        if (connectedCustomer && connectedCustomer.length) {
                          connectedCustomer.map((cuustomer) =>
                            app.ioLiveBids
                              .to(cuustomer.socketId)
                              .emit(OFFER_CREATED, offer)
                          );
                        }

                        callback(200, offer);
                      } else {
                        callback(403);
                      }
                  })
                );
                console.log("offer created");
              });
            } else {
              callback(404);
            }
          }
        }
      );
    });
  });

  socket.on(OFFER_ACCEPTED, (offerId, callback) => {
    Offer.findOne({ _id: offerId }, (err, foundedOffer) => {
      if (err) console.log("Search in database error");

      if (foundedOffer) {
        foundedOffer.accept();
        foundedOffer.save().then(() => {
          const connectedDealer = connectedUsers.filter(
            (connectedUser) => connectedUser.id === foundedOffer.dealerId
          );
          if (connectedDealer && connectedDealer.length)
            connectedDealer.map((dealer) =>
              app.ioLiveBids
                .to(dealer.socketId)
                .emit(
                  OFFER_ACCEPTED,
                  foundedOffer.parentBidId,
                  foundedOffer._id
                )
            );
        });
        console.log(`offer ${offerId} accepted`);
      }
      callback(foundedOffer);
    });
  });

  socket.on(END_CAMPAIGN, ({ bidId }, callback) => {
    Bid.findOne({ _id: bidId }, (err, foundedBid) => {
      if (err) {
        console.log("Search in database error");
      }

      if (foundedBid && foundedBid.userId === socket.user.id) {
        let customers = [];
        let dealers = [];
        Users.find({ bids: foundedBid._id }, (err, users) => {
          if (!err && users && users.length) {
            customers = users.filter((user) => user.role === "customer");
            dealers = users.filter((user) => user.role === "dealer");

            dealers.forEach((dealer) => {
              dealer.markAsRead(bidId);
              dealer.save();
            });
          }
        });

        foundedBid.close();
        Offer.find(
          {
            _id: { $in: foundedBid.responses },
          },
          (err, offers) => {
            if (offers && offers.length)
              offers.map((offer) => {
                offer.close();
                offer.save().then(() => {
                  customers.forEach((customer) => {
                    customer.markAsRead(offer._id.toString());
                    customer.save();
                  });
                });
              });
          }
        );
        foundedBid.save().then(() => {
          callback({ message: "End campaign" });
          const connectedDealer = connectedUsers.filter(
            (connectedUser) => connectedUser.bids.indexOf(bidId) !== -1
          );
          if (connectedDealer && connectedDealer.length)
            connectedDealer.map((dealer) =>
              app.ioLiveBids.to(dealer.socketId).emit(END_CAMPAIGN, bidId)
            );
        });
      } else callback({ message: "Bid not found", error: 409 });
    });
  });

  socket.on(REQUEST_OUT_THE_DOOR_PRICE, (userId, offerId, callback) => {
    Offer.findOne({ _id: offerId }, (err, foundedOffer) => {
      if (err) {
        console.log("Search in database error");
      }

      if (foundedOffer) {
        const connectedDealer = connectedUsers.filter(
          (connectedUser) => connectedUser.id === foundedOffer.dealerId
        );
        if (connectedDealer && connectedDealer.length)
          connectedDealer.map((dealer) =>
            app.ioLiveBids
              .to(dealer.socketId)
              .emit(REQUEST_OUT_THE_DOOR_PRICE, foundedOffer._id)
          );
        foundedOffer.save().then(() => callback());
      } else callback("Offer not found");
    });
  });

  socket.on(MARK_AS_READ, ({ id }, callback) => {
    Users.findOne({ _id: socket.user.id }, (err, foundedUser) => {
      if (err) {
        console.log("Search in database error");
      }

      if (foundedUser) {
        foundedUser.markAsRead(id);
        foundedUser.save().then(() => callback(true));
      } else callback("Offer not found");
    });
  });

  socket.on(GET_LAST_SEEN_LIST, ({}, callback) => {
    Users.findOne({ _id: socket.user.id }, (err, foundedUser) => {
      if (err) {
        console.log("Search in database error");
      }

      if (foundedUser) {
        callback(foundedUser.lastSeenMessages);
      } else callback("User not found");
    });
  });

  socket.on(SET_LAST_SEEN, ({ offerId, date }, callback) => {
    Users.findOne({ _id: socket.user.id }, (err, foundedUser) => {
      if (err) {
        console.log("Search in database error");
      }

      if (foundedUser && foundedUser.lastSeenMessages) {
        foundedUser.lastSeenMessages = {
          ...foundedUser.lastSeenMessages,
          [offerId]: date,
        };
        foundedUser.save().then(() => callback(true));
      } else callback("User not found");
    });
  });

  socket.on(MESSAGE_SEND, ({ offerId, message }) => {
    Users.findOne({ _id: socket.user.id }, (err, foundedUser) => {
      if (foundedUser) {
        if (foundedUser.role === "dealer") {
          Offer.findOne({ _id: offerId }, (err, foundedOffer) => {
            if (foundedOffer) {
              Bid.findOne(
                { _id: foundedOffer.parentBidId },
                (err, foundedBid) => {
                  if (foundedBid) {
                    Users.findOne(
                      { _id: foundedBid.userId },
                      (err, foundedReceiver) => {
                        if (foundedReceiver) {
                          const fitNotificationsType = ["all", "chat"];
                          if (
                            fitNotificationsType.indexOf(
                              foundedReceiver.notificationsType
                            ) !== -1
                          )
                            sendMsg(
                              foundedReceiver.email,
                              "New message",
                              "Your received new message from dealer"
                            );
                        }
                      }
                    );
                  }
                }
              );
            }
          });
        } else {
          Offer.findOne({ _id: offerId }, (err, foundedOffer) => {
            if (foundedOffer) {
              Users.findOne(
                { _id: foundedOffer.dealerId },
                (err, foundedReceiver) => {
                  if (foundedReceiver) {
                    const fitNotificationsType = ["all", "chat"];
                    if (
                      fitNotificationsType.indexOf(
                        foundedReceiver.notificationsType
                      ) !== -1
                    )
                      sendMsg(
                        foundedReceiver.email,
                        "New message",
                        "Your received new message from customer"
                      );
                  }
                }
              );
            }
          });
        }
      }
    });
  });
};
