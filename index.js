const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const userModel = require("./models/user");
const clubRoutes = require("./routes/clubRoutes");
const eventRoutes = require("./routes/eventRoutes");
const companyRoutes=require("./routes/companyRoutes")
const verifyUser = require("./middlewares/auth.middleware");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const passport = require("passport");
const session = require("express-session");
const rateLimit = require("express-rate-limit");
const app = express();
const GoogleStrategy = require("passport-google-oauth20").Strategy;
require("dotenv").config();
require("./passport");
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${process.env.SERVER}/auth/google/callback`,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await userModel.findOne({ googleId: profile.id });
        if (user) {
          return done(null, user);
        }
        user = await new userModel({
          name: profile.displayName,
          email: profile.emails[0].value,
          googleId: profile.id,
        }).save();

        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  )
);

app.use(
  session({
    secret: `${process.env.SESSION_SECRET}`,
    resave: false,
    saveUninitialized: true,
  })
);
app.use(passport.initialize());
app.use(passport.session());

app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/login",
  }),
  (req, res) => {
    const username = req.user.name;
    res.redirect(`${process.env.USER_ORIGIN}/UserPage/${username}`);
  }
);
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  userModel
    .findById(id)
    .then((user) => done(null, user))
    .catch((err) => done(err));
});

app.get("/", (req, res) => {
  res.send(req.user ? `Hello, ${req.user.displayName}! ` : "Not logged in.");
});
app.get("/logout", (req, res) => {
  try {
    res.clearCookie("token", {
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    });
    console.log("done");
  } catch (err) {
    console.log(err);
  }
  res.status(200).json({ success: true, message: "Logged out successfully" });
});

app.use(express.json());
app.use(cookieParser());
const allowedOrigins = [
  process.env.ADMIN_ORIGIN,
  process.env.USER_ORIGIN,
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
}));


app.get("/me", verifyUser, async (req, res) => {
  try {
    const user = await userModel.findOne({ email: req.user.email });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

mongoose
  .connect(`${process.env.MONGODB_URI}/${process.env.DATABASE_NAME}`)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.log("MongoDB connection error:", err));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 5, 
  message: {
    success: false,
    message: "Too many login attempts. Try again later.",
  },
});
app.post("/LoginUser", loginLimiter, (req, res) => {
  const { email, password } = req.body;
  console.log("Email received:", email);

  userModel
    .findOne({ email: email })
    .then((user) => {
      if (user) {
        console.log("Password received:", password);
        console.log("Hashed password in DB:", user.password);
        if (!password || !user.password) {
          return res.status(400).json({
            success: false,
            message: "Missing credentials",
          });
        }

        bcrypt
          .compare(password, user.password)
          .then((isMatch) => {
            if (isMatch) {
              const token = jwt.sign(
                { email: user.email },
                `${process.env.JWT_SECRET_KEY}`,
                { expiresIn: "1d" }
              );
              res.cookie("token", token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "Strict",
                maxAge: 24 * 60 * 60 * 1000,
              });
              res.json({
                success: true,
                message: "Successfully logged in",
                user: user.name,
              });
            } else {
              res.json({ success: false, message: "Incorrect password" });
            }
          })
          .catch((err) => {
            console.error("Error comparing passwords:", err);
            res
              .status(500)
              .json({ success: false, message: "Login error", error: err });
          });
      } else {
        res.json({ success: false, message: "User not registered" });
      }
    })
    .catch((err) => {
      console.error("Error during login:", err);
      res
        .status(500)
        .json({ success: false, message: "Login error", error: err });
    });
});

app.post("/RegUser", async (req, res) => {
  const { name, email, password } = req.body;
  console.log(email)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const strongPasswordRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;

  try {
    if (
      [name, email, password].some((field) => !field || field.trim() === "")
    ) {
      return res
        .status(400)
        .json({ success: false, message: "All fields are required" });
    }

    if (!emailRegex.test(email)) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Invalid email format",
        });
    }

    if (!strongPasswordRegex.test(password)) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be at least 8 characters long and include uppercase, lowercase, number, and special character",
      });
    }

    const existingUser = await userModel.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ success: false, message: "User already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await userModel.create({
      name,
      email,
      password: hashedPassword,
    });

    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
    };

    return res.status(201).json({ success: true, user: userResponse });
  } catch (err) {
    console.error("Error during registration:", err);
    return res
      .status(500)
      .json({
        success: false,
        message: "Internal server error",
        error: err.message,
      });
  }
});

app.use("/api", clubRoutes);
app.use("/api", eventRoutes);
app.use("/api",companyRoutes)
const server = app.listen(process.env.PORT, () => {
  console.log(`Server is running on port ${process.env.PORT}`);
});
const io = require("socket.io")(server, {
  pingTimeout: 60000,
  cors: {
    origin: `${process.env.USER_ORIGIN}`,
    methods: ["GET", "POST"],
    credentials: true,
  },
});
io.on("connection", (socket) => {
  console.log("connected to socket.io");
  socket.on("setup", (userdata) => {
    socket.join(userdata._id);
    socket.emit("connected");
  });
  socket.on("joinRoom", (clubId) => {
    socket.join(clubId);
    console.log("User joined the club discussion room");
  });
  socket.on("send_message", (messageData) => {
    if (messageData && messageData.receiverId) {
      io.to(messageData.receiverId).emit("receive_message", messageData);
    }
  });
  socket.on("sendMessage", (message) => {
    console.log("Message received:", message);

    //   const { chatId, senderId, content } = message;
    const { clubId, text } = message;
    console.log(clubId);
    if (clubId) {
      socket.to(clubId).emit("joinRoom", message);
      console.log(`Message broadcasted to room: ${clubId}`);
    }
  });
});
