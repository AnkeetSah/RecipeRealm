const NodeCache = require("node-cache");
const cache = new NodeCache({ stdTTL: 3600 }); // Cache TTL of 1 hour
const userModel = require("../models/user");
const fetch = (...args) => import("node-fetch").then(({default: fetch}) => fetch(...args));

// Get all dishes by area
const getDishesByArea = async (req, res) => {
  const key = req.params.areaname;

  // ✅ Check if data exists in cache
  if (cache.has(key)) {
    const dishData = cache.get(key);
    dishData.forEach(d => d.area = key);
    return res.render("areadish", { dishData });
  }

  try {
    // ✅ Fetch data from API
    const dishResponse = await fetch(
      `https://www.themealdb.com/api/json/v1/1/filter.php?a=${key}`
    );
    const dishes = await dishResponse.json();
    const dishData = dishes.meals;

    // ✅ Save to cache
    cache.set(key, dishData);
    dishData.forEach(d => d.area = key);

    res.render("areadish", { dishData });
  } catch (error) {
    console.error(error);
    res.status(500).send("An error occurred while fetching data.");
  }
};

// Get single recipe by ID
const getRecipeById = async (req, res) => {
  try {
    const user = await userModel.findOne({ email: req.user.email });
    const id = req.params.id;

    const recipeResponse = await fetch(
      `https://www.themealdb.com/api/json/v1/1/lookup.php?i=${id}`
    );
    const recipe = await recipeResponse.json();
    const data = recipe.meals[0];

    res.render("recipe", { data, user });
  } catch (error) {
    console.error(error);
    res.status(500).send("An error occurred while fetching data.");
  }
};

module.exports = {
  getDishesByArea,
  getRecipeById
};
