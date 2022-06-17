const express = require("express");
const router = express.Router();

router.use("/users", require("./users"));
router.use("/fuel", require("./fuel"));
router.use("/test", require("./test"));

module.exports = router;
