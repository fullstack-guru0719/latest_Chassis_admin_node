const mongoose = require("mongoose");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const GoogleStrategy = require("passport-google-token").Strategy;
const FacebookStrategy = require("passport-facebook-token");
const { google, facebook } = require("../config/socialCredits");
const Users = mongoose.model("Users");

passport.use(
  new LocalStrategy(
    {
      usernameField: "user[email]",
      passwordField: "user[password]",
    },
    (email, password, done) => {
      Users.findOne({ email })
        .then((user) => {
          if (
            !user ||
            user.googleId ||
            user.facebookId ||
            !user.validatePassword(password)
          ) {
            return done(null, false, {
              errors: { "email or password": "is invalid" },
            });
          }

          return done(null, user);
        })
        .catch(done);
    }
  )
);

passport.use(
  "googleToken",
  new GoogleStrategy(
    {
      clientID: google.clientID,
      clientSecret: google.clientSecret,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const existingUser = await Users.findOne({ googleId: profile.id });
        if (existingUser) {
          return done(null, existingUser);
        }

        const newUser = new Users({
          googleId: profile.id,
          email:
            profile.emails && profile.emails[0] ? profile.emails[0].value : "",
        });

        await newUser.save();
        done(null, newUser);
      } catch (error) {
        done(error, false, error.message);
      }
    }
  )
);

passport.use(
  "facebookToken",
  new FacebookStrategy(
    {
      clientID: facebook.clientID,
      clientSecret: facebook.clientSecret,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const existingUser = await Users.findOne({ facebookId: profile.id });
        if (existingUser) {
          return done(null, existingUser);
        }

        const newUser = new Users({
          facebookId: profile.id,
          email:
            profile.emails && profile.emails[0] ? profile.emails[0].value : "",
        });

        await newUser.save();
        done(null, newUser);
      } catch (error) {
        done(error, false, error.message);
      }
    }
  )
);
