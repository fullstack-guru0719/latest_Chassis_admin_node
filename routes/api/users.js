const mongoose = require("mongoose");
const passport = require("passport");
const jwt = require("jsonwebtoken");
const router = require("express").Router();
const auth = require("../auth");
const Users = mongoose.model("Users");

const passRegExp = new RegExp(
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/
);

//POST new customer route
router.post("/registerCustomer", auth.optional, (req, res, next) => {
  const {
    body: { user },
  } = req;

  if (!user.email) {
    return res.sendStatus(422).json({
      errors: {
        email: "is required",
      },
    });
  }

  if (!user.password) {
    return res.sendStatus(422).json({ errors: { password: "is required" } });
  } else if (!passRegExp.test(user.password)) {
    return res.status(422).json({
      errors: { password: "wrong format" },
    });
  }

  Users.findOne({ email: user.email }, (err, foundedUser) => {
    if (err) {
      console.log("Search in database error");
    }

    if (foundedUser) {
      return res.sendStatus(409);
    } else {
      const finalUser = new Users({
        ...user,
        role: "customer",
        createdAt: new Date().getTime(),
        notificationsType: "all",
      });

      finalUser.setPassword(user.password);

      return finalUser
        .save()
        .then(() => res.json({ user: finalUser.toAuthJSON() }));
    }
  });
});

//POST new dealer route
router.post("/registerDealer", auth.optional, (req, res, next) => {
  const {
    body: { user },
  } = req;

  if (!user.email) {
    return res.sendStatus(422).json({
      errors: {
        email: "is required",
      },
    });
  }

  if (!user.password) {
    return res.sendStatus(422).json({ errors: { password: "is required" } });
  } else if (!passRegExp.test(user.password)) {
    return res.status(422).json({
      errors: { password: "wrong format" },
    });
  }

  if (!user.zip) {
    return res.sendStatus(422).json({
      errors: {
        zip: "is required",
      },
    });
  }

  if (!user.name) {
    return res.sendStatus(422).json({
      errors: {
        name: "is required",
      },
    });
  }

  Users.findOne({ email: user.email }, (err, foundedUser) => {
    if (err) {
      console.log("Search in database error");
    }

    if (foundedUser) {
      return res.sendStatus(409);
    } else {
      const finalUser = new Users({
        ...user,
        role: "dealer",
        createdAt: new Date().getTime(),
        notificationsType: "all",
      });

      finalUser.setPassword(user.password);

      return finalUser
        .save()
        .then(() => res.json({ user: finalUser.toAuthJSON() }));
    }
  });
});

//POST login route (optional, everyone has access)
router.post("/login", auth.optional, (req, res, next) => {
  const {
    body: { user },
  } = req;

  if (!user.email) {
    return res.sendStatus(422).json({
      errors: {
        email: "is required",
      },
    });
  }

  if (!user.password) {
    return res.sendStatus(422).json({
      errors: {
        password: "is required",
      },
    });
  }

  return passport.authenticate(
    "local",
    { session: false },
    (err, passportUser, info) => {
      if (err) {
        return next(err);
      }

      if (passportUser) {
        const user = passportUser;
        user.token = passportUser.generateJWT();

        return res.json({ user: user.toAuthJSON() });
      }

      return res.sendStatus(400);
    }
  )(req, res, next);
});

router.post("/oauth/facebook", auth.optional, (req, res, next) => {
  return passport.authenticate(
    "facebookToken",
    { session: false },
    (err, passportUser, info) => {
      if (err) {
        return next(err);
      }

      if (passportUser) {
        const user = passportUser;
        user.token = passportUser.generateJWT();

        return res.json({ user: user.toAuthJSON() });
      }

      return res.sendStatus(400);
    }
  )(req, res, next);
});

router.post("/oauth/google", auth.optional, (req, res, next) => {
  return passport.authenticate(
    "googleToken",
    { session: false },
    (err, passportUser, info) => {
      if (err) {
        return next(err);
      }

      if (passportUser) {
        const user = passportUser;
        user.token = passportUser.generateJWT();

        return res.json({ user: user.toAuthJSON() });
      }

      return res.sendStatus(400);
    }
  )(req, res, next);
});

//POST reset password (optional, everyone has access)
router.post("/changePassword", auth.required, (req, res, next) => {
  const {
    body: { email, oldPassword, newPassword },
  } = req;
  if (!email)
    return res.sendStatus(422).json({ errors: { email: "is required" } });

  Users.findOne({ email })
    .then((user) => {
      if (!user || !user.validatePassword(oldPassword)) {
        return res.json({ error: "Old password is invalid" });
      } else {
        user.setPassword(newPassword);
        user.save().then(() => res.sendStatus(200));
      }
    })
    .catch((err) => `changePassword failed: ${err}`);
});

//POST reset password request (optional, everyone has access)
router.post("/resetPasswordReq", auth.optional, (req, res, next) => {
  const {
    body: { email },
  } = req;

  if (!email)
    return res.sendStatus(422).json({ errors: { email: "is required" } });

  Users.findOne({ email }, function (err, user) {
    if (!user) {
      return res.status(404);
    } else {
      const SENDGRID_API_KEY =
        "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";
      const isProduction = process.env.NODE_ENV === "production";
      const token = jwt.sign(
        { id: user._id, email: user.email },
        `${user.hash}-${user.createdAt}`
      );
      const link = `${
        isProduction ? "https://www.dealstryker.com" : "http://localhost:3000"
      }/resetPassword?id=${user._id}&token=${token}`;

      const sgMail = require("@sendgrid/mail");
      sgMail.setApiKey(SENDGRID_API_KEY);
      const msg = {
        to: email,
        from: "dealtester@dealstryker.com",
        subject: "Reset password",
        html: `<a href=${link}>Link for password reset</a>`,
      };
      sgMail
        .send(msg)
        .then(() => res.status(200))
        .catch((err) => {
          console.log("SendGrid sending error: ", err);
          res.status(400);
        });
    }
  });
});

//POST reset password (optional, everyone has access)
router.post("/resetPassword", auth.optional, (req, res, next) => {
  const {
    body: { id, token, newPassword },
  } = req;

  if (!id) return res.sendStatus(422).json({ errors: { id: "is required" } });
  if (!token)
    return res.sendStatus(422).json({ errors: { token: "is required" } });
  if (!newPassword)
    return res.sendStatus(422).json({ errors: { newPassword: "is required" } });

  Users.findOne({ _id: id }, function (err, user) {
    if (!user) {
      return res.status(404);
    } else {
      const secret = `${user.hash}-${user.createdAt}`;
      jwt.verify(token, secret, (err, decoded) => {
        if (
          !err &&
          decoded &&
          decoded.email === user.email &&
          !passRegExp.test(newPassword)
        ) {
          user.setPassword(newPassword);
          user.save().then(() => res.status(200).json({ code: 200 }));
        } else
          return res
            .status(200)
            .json({ code: 404, errors: { token: "is invalid" } });
      });
    }
  });
});

router.post("/getUserData", auth.required, (req, res, next) => {
  const {
    body: { email },
  } = req;
  if (!email) return res.status(422).json({ errors: { email: "is required" } });

  Users.findOne({ email })
    .then((user) => {
      if (user) {
        res.status(200).json({
          notificationsType: user.notificationsType,
          unreadLiveBids: user.unreadLiveBids,
        });
      }
    })
    .catch((err) => `changePassword failed: ${err}`);
});

router.post("/setNotificationsType", auth.required, (req, res, next) => {
  const {
    body: { email, type },
  } = req;
  if (!email) return res.status(422).json({ errors: { email: "is required" } });

  Users.findOne({ email })
    .then((user) => {
      if (user) {
        user.setNotificationsType(type);
        user.save().then(() => res.json({ type }));
      }
    })
    .catch((err) => `changePassword failed: ${err}`);
});

router.post("/upload", auth.required, (req, res, next) => {
  if (!Object.keys(req.files).length) {
    return res.status(400).send("No files were uploaded.");
  }

  // The name of the input field (i.e. "sampleFile") is used to retrieve the uploaded file
  let sampleFile = req.files.attachment;

  const uploadPath =
    require("../../app").uploadsPath +
    new Date().getTime().toString() +
    "_" +
    sampleFile.name;

  // Use the mv() method to place the file somewhere on your server
  sampleFile.mv(uploadPath, function (err) {
    if (err) return res.status(500).send(err);

    res.send({
      status: true,
      path: uploadPath,
    });
  });
});

module.exports = router;
