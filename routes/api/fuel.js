const express = require("express");
const router = express.Router();
const axios = require("axios");

router.get("/manu", (req, res, next) => {
  // handles Manufacturering Routing
  var ModelRoute =
    "https://api.fuelapi.com/v1/json/makes/?year=2019&api_key=daefd14b-9f2b-4968-9e4d-9d4bb4af01d1";

  axios
    .get(ModelRoute)
    .then((resp) => {
      // handles success
      res.send(resp.data);
      console.log("1 - Hello!!!");
    })
    .catch(function (error) {
      // handle error
      res.send(error);
      console.log(error);
    });
});

router.get("/models/:manuID", (req, res, next) => {
  // handles Models Routing

  var MANU_ID = Number(req.params.manuID); // number example 12

  var model_route =
    "https://api.fuelapi.com/v1/json/models/" +
    MANU_ID +
    "?year=2019&api_key=daefd14b-9f2b-4968-9e4d-9d4bb4af01d1";

  axios
    .get(model_route)
    .then((resp) => {
      // handles success
      console.log("2 - Hello!!!");
      var VehicleList = resp.data.slice(0, 4); // returns the first 4 vehicles in the list
      res.send(VehicleList);
    })
    .catch(function (error) {
      // handle error
      res.send(error);
      console.log(error);
    });
});

router.get("/trims/:manu/:model", (req, res, next) => {
  // handles Trims Routing

  var MANU = req.params.manu; // strings example - FORD
  var MODEL = req.params.model; // strings example - FIESTA

  var trim_route =
    "https://api.fuelapi.com/v1/json/vehicles/?year=2019&make=" +
    MANU +
    "&model=" +
    MODEL +
    "&api_key=daefd14b-9f2b-4968-9e4d-9d4bb4af01d1";

  axios
    .get(trim_route)
    .then((resp) => {
      // handles success
      res.send(resp.data);
    })
    .catch(function (error) {
      // handle error
      res.send(error);
      console.log(error);
    });
});

router.get("/colors/:trim", (req, res, next) => {
  // handles Colors Routing

  var TRIM = Number(req.params.trim); // number example 12

  var color_route =
    "https://api.fuelapi.com/v1/json/vehicle/" +
    TRIM +
    "&api_key=daefd14b-9f2b-4968-9e4d-9d4bb4af01d1&productID=2";

  axios
    .get(color_route)
    .then((resp) => {
      // handles success
      res.send(resp.data);
    })
    .catch(function (error) {
      // handle error
      res.send(error);
      console.log(error);
    });
});

router.get("/ideal/:trim", (req, res, next) => {
  // handles Ideal Routing

  var TRIM = Number(req.params.trim); // number example 12

  var ideal_route =
    "https://api.fuelapi.com/v1/json/vehicle/" +
    TRIM +
    "&api_key=daefd14b-9f2b-4968-9e4d-9d4bb4af01d1&productID=1&shotCode=116";

  axios
    .get(ideal_route)
    .then((resp) => {
      // handles success
      res.send(resp.data);
    })
    .catch(function (error) {
      // handle error
      res.send(error);
      console.log(error);
    });
});

module.exports = router;
