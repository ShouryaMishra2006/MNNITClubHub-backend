const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const userModel = require("./models/user");
const clubRoutes = require("./routes/clubRoutes");
const eventRoutes = require("./routes/eventRoutes");
const companyRoutes = require("./routes/companyRoutes");
const verifyUser = require("./middlewares/auth.middleware");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const passport = require("passport");
const session = require("express-session");
const rateLimit = require("express-rate-limit");
const GoogleStrategy = require("passport-google-oauth20").Strategy;

require("dotenv").config();

const app = express();
app.use(express.json());
app.use(cookieParser());

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);

app.use(passport.initialize());
app.use(passport.session());

const allowedOrigins = [process.env.ADMIN_ORIGIN, process.env.USER_ORIGIN];
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);
passport.use(
  "google-register",
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${process.env.SERVER}/auth/google/callback`,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await userModel.findOne({ googleId: profile.id });
        if (user) return done(null, user);
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

passport.use(
  "google-login",
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${process.env.SERVER}/auth/google/login/callback`,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const user = await userModel.findOne({ googleId: profile.id });
        if (user) return done(null, user);
        return done(null, false, { message: "User not registered" });
      } catch (err) {
        return done(err);
      }
    }
  )
);
passport.serializeUser((user, done) => {
  done(null, user.id);
});
passport.deserializeUser((id, done) => {
  userModel.findById(id).then(user => done(null, user)).catch(err => done(err));
});

app.get("/auth/google", passport.authenticate("google-register", { scope: ["profile", "email"] }));

app.get(
  "/auth/google/callback",
  passport.authenticate("google-register", {
    failureRedirect: `${process.env.USER_ORIGIN}/login?error=google_register_failed`,
  }),
  (req, res) => {
    const username = req.user.name;
    res.redirect(`${process.env.USER_ORIGIN}/UserPage/${username}`);
  }
);
app.get("/auth/google/login", passport.authenticate("google-login", { scope: ["profile", "email"] }));

app.get("/auth/google/login/callback", (req, res, next) => {
  passport.authenticate("google-login", (err, user, info) => {
    if (err || !user) {
      return res.redirect(`${process.env.USER_ORIGIN}/login?error=not_registered`);
    }
    req.login(user, err => {
      if (err) {
        return res.redirect(`${process.env.USER_ORIGIN}/login?error=login_failed`);
      }
      return res.redirect(`${process.env.USER_ORIGIN}/UserPage/${user.name}`);
    });
  })(req, res, next);
});
app.get("/", (req, res) => {
  res.send(req.user ? `Hello, ${req.user.displayName}!` : "Not logged in.");
});

app.get("/logout", (req, res) => {
  try {
    res.clearCookie("token", {
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    });
  } catch (err) {
    console.log(err);
  }
  res.status(200).json({ success: true, message: "Logged out successfully" });
});
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
app.post("/LoginUser", loginLimiter, async (req, res) => {
  const { email, password } = req.body;
  console.log("Email received:", email);

  try {
    const user = await userModel.findOne({ email });
    if (!user) return res.json({ success: false, message: "User not registered" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.json({ success: false, message: "Incorrect password" });

    const token = jwt.sign({ email: user.email }, process.env.JWT_SECRET_KEY, {
      expiresIn: "1d",
    });

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
      maxAge: 24 * 60 * 60 * 1000,
    });

    res.json({ success: true, message: "Successfully logged in", user: user.name });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ success: false, message: "Login error", error: err.message });
  }
});

app.post("/RegUser", async (req, res) => {
  const { name, email, password } = req.body;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;

  try {
    if ([name, email, password].some(field => !field || field.trim() === "")) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: "Invalid email format" });
    }

    if (!strongPasswordRegex.test(password)) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long and include uppercase, lowercase, number, and special character",
      });
    }

    const existingUser = await userModel.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: "User already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await userModel.create({ name, email, password: hashedPassword });

    return res.status(201).json({
      success: true,
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error("Registration error:", err);
    return res.status(500).json({ success: false, message: "Internal server error", error: err.message });
  }
});

app.use("/api", clubRoutes);
app.use("/api", eventRoutes);
app.use("/api", companyRoutes);

const server = app.listen(process.env.PORT, () => {
  console.log(`Server is running on port ${process.env.PORT}`);
});

// Socket.IO setup
const io = require("socket.io")(server, {
  pingTimeout: 60000,
  cors: {
    origin: process.env.USER_ORIGIN,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

io.on("connection", (socket) => {
  console.log("Connected to socket.io");

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
    const { clubId, text } = message;
    if (clubId) {
      socket.to(clubId).emit("joinRoom", message);
      console.log(`Message broadcasted to room: ${clubId}`);
    }
  });
});
