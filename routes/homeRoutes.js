// routes/homeRoutes.js
const express = require('express');
const router = express.Router();
const homeController = require('../controllers/homeRoutesController');

const isLoggedIn = require('../middlewares/isLoggedIn');

// Apply isLoggedIn middleware to all routes
router.use(isLoggedIn);

router.get("/", homeController.getHome);  // Accessed at /home/
router.get("/area", homeController.getArea);  // Accessed at /home/area
router.get("/account", homeController.getAccount);  // Accessed at /home/account
router.get("/recipe", homeController.getRecipe);  // Accessed at /home/recipe
router.get("/aboutus", homeController.getAboutUs);  // Accessed at /home/aboutus
router.get("/leaderBoard", homeController.getLeaderBoard);  // Accessed at /home/leaderBoard



module.exports = router;
