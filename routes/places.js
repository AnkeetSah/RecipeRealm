const express = require("express");
const router = express.Router();
const isLoggedIn = require("../middlewares/isLoggedIn");
const { getDishesByArea, getRecipeById } = require("../controllers/placesController");

router.get("/:areaname", getDishesByArea);
router.get("/:areaname/:id", isLoggedIn, getRecipeById);

module.exports = router;
