const { jwtVerify } = require("../helper/jwt");
const { User } = require("../models");

const optionalAuthentication = async (req, _res, next) => {
  try {
    const authorization = req.headers.authorization;
    if (!authorization) return next();

    const token = authorization.split(" ")[1];
    if (!token) return next();

    const userVerified = await jwtVerify(token);
    if (!userVerified) return next();

    const loggedUser = await User.findOne({
      attributes: { exclude: ["email"] },
      where: { email: userVerified.email },
    });

    if (loggedUser) {
      req.headers.email = userVerified.email;
      loggedUser.dataValues.token = token;
      req.loggedUser = loggedUser;
    }

    next();
  } catch {
    next();
  }
};

module.exports = optionalAuthentication;
