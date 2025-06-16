const jwt = require("jsonwebtoken");

const verifyUser = (req, res, next) => {
  const token = req.cookies.token;

  if (!token) {
    console.warn("Token missing in request cookies.");
    return res.status(401).json({ success: false, message: "Unauthorized: No token provided" });
  }

  jwt.verify(token, process.env.JWT_SECRET_KEY, (err, decoded) => {
    if (err) {
      console.error("JWT verification failed:", err.message);
      return res.status(403).json({ success: false, message: "Forbidden: Invalid token" });
    }

    req.user = decoded; 
    next();
  });
};

module.exports = verifyUser;
