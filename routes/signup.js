const express = require("express");
const router = express.Router();
const isLoggedIn = require('../middlewares/isLoggedIn');



router.get("/",isLoggedIn, (req, res) => {
  res.render("sign-up"); 
});

module.exports = router;
