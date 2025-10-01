const express = require('express');
const router = express.Router();


router.get('/', (req, res) => {
 res.render("recipeOption")
});


// Render the page with static data
router.get('/recipeBySingleIngredinet', (req, res) => {

  res.render('singlerecipe', );
});

router.get('/recipeByMultiIngredinet', (req, res) => {

  res.render('form', );
});

module.exports = router;
