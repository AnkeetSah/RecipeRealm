const express = require("express");
const router = express.Router();


router.get("/", (req, res) => {
  res.render("sign-up"); 
});

module.exports = router;
