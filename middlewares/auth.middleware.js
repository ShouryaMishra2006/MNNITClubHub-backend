const jwt=require("jsonwebtoken")
//user authentication

const verifyUser = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
      return res.status(401).json({ success: false, message: "Unauthorized: No token provided" });
  }
  
  jwt.verify(token, process.env.JWT_SECRET_KEY, (err, decoded) => {
      if (err) {
          return res.status(403).json({ success: false, message: "Forbidden: Invalid token" });
      }
      req.user = decoded; 
      next();
  });
};
module.exports=verifyUser