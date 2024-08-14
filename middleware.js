const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");

const hashedPass = async (req, res, next) => {
  const password = req.body.password;
  const hashedPassword = await bcrypt.hash(password, 10);
  req.body.password = hashedPassword;
  next();
};

const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).send({ message: "Not authorized" });
  }
  jwt.verify(token, process.env.token, (er, decoded) => {
    if (er) {
      res.status(401).send({ message: "unauthorized" });
    }
    req.user = decoded;
    next();
  });
};
module.exports = { hashedPass, verifyToken };
