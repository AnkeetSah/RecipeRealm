// routes/homeRoutes.js
const express = require('express');
const router = express.Router();
const homeController = require('../controllers/homeRoutesController');
const leaderBoardController = require('../controllers/leaderBoardController');
const aboutUsController = require('../controllers/aboutUs');
const isLoggedIn = require('../middlewares/isLoggedIn');

// Apply isLoggedIn middleware to all routes
router.use(isLoggedIn);

router.get("/", homeController.getHome);  // Accessed at /home/
router.get("/area", homeController.getArea);  // Accessed at /home/area
router.get("/account", homeController.getAccount);  // Accessed at /home/account
router.get("/aboutus", aboutUsController.getAboutUs);  // Accessed at /home/aboutus
router.get("/leaderBoard", leaderBoardController.getLeaderBoard);  // Accessed at /home/leaderBoard

module.exports = router;
