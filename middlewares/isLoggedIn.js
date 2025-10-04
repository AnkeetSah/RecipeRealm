const jwt = require("jsonwebtoken");

const isLoggedIn = (req, res, next) => {
  if (!req.cookies.token || req.cookies.token === "") {
    return res.redirect("/"); // Redirect to login page if token is missing
  } else {
    try {
      let data = jwt.verify(req.cookies.token, "shhhhh");
      req.user = data;
      
      
      next();
    } catch (err) {
      return res.redirect("/login"); // Redirect to login page on verification failure
    }
  }
};

module.exports = isLoggedIn;
