const fs = require("fs");
const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const session = require("express-session");
const cors = require("cors");
const fileUpload = require("express-fileupload");
const mongoose = require("mongoose");
const errorHandler = require("errorhandler");
const compression = require("compression");
const sslRedirect = require("heroku-ssl-redirect");

//Configure mongoose's promise to global promise
mongoose.promise = global.Promise;

//Configure isProduction variable
const isProduction = process.env.NODE_ENV === "production";
//Configure port var
const PORT = process.env.PORT || 5000;

//Initiate our app
const app = express();
const liveBidsServer = require("http").createServer(app);

//Configure our app
app.use(compression()); // all APP Funcs after this!
app.use((req, res, next) => {
  res.header("Cache-Control", "max-age=31536000");
  next();
});
const cacheRefresh = 31536000; // 31536000 = 8.76 ish hours

app.use(sslRedirect()); // SSL Force Redirect w/ Heroku
app.use(cors());
app.use(require("morgan")("dev"));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));
app.use(
  session({
    secret: "dealstryker",
    cookie: { maxAge: 60000 },
    resave: false,
    saveUninitialized: false,
  })
);

app.use(function (req, res, next) {
  // Allowing Cors
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});

app.use(
  fileUpload({
    abortOnLimit: true,
    limits: { fileSize: 2 * 1024 * 1024 },
  })
);

//Configure Mongoose
if (!isProduction) {
  app.use(errorHandler());
  // mongoose.connect("mongodb://localhost/dealstryker", {
  //   useNewUrlParser: true,
  // });
  mongoose.connect(
    "mongodb+srv://DealStryker:4rDlX5UcVur9K0f2@dealstryker-ieho9.mongodb.net/test?retryWrites=true&w=majority",
    { useNewUrlParser: true }
  );
  mongoose.set("debug", false);
} else {
  mongoose.connect(
    "mongodb+srv://DealStryker:4rDlX5UcVur9K0f2@dealstryker-ieho9.mongodb.net/test?retryWrites=true&w=majority",
    { useNewUrlParser: true }
  );
  mongoose.set("debug", false);
}

//Models & routes
require("./models/Users");
require("./models/Bid");
require("./models/PotentialBuyer");
require("./config/passport");
app.use(require("./routes"));

//Error handlers & middlewares
app.use((err, req, res, next) => {
  res.status(err.status || 500);

  res.json({
    errors: {
      message: err.message,
      error: {},
    },
  });
});

//Socket.io
const LiveBids = require("./LiveBids");
const io = (module.exports.ioLiveBids = require("socket.io")(liveBidsServer));
io.on("connection", LiveBids);

//UI
app.use(express.static(path.join(__dirname, "client/build")));

!fs.existsSync("uploads") && fs.mkdirSync("uploads");
module.exports.uploadsPath = path.join(__dirname, "uploads/");

app.get("*", (req, res) => {
  res.sendFile(path.resolve(__dirname, "client", "build", "index.html"), {
    maxAge: cacheRefresh,
  });
});

liveBidsServer.listen(PORT, (err) => {
  if (err) throw err;
  console.log("Server Running at " + PORT);
});
