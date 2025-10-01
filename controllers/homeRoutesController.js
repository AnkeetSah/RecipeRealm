// controllers/homeRoutesController.js



const userModel = require('../models/user');
const cache = require('node-cache'); // Make sure to import cache if used here
const areaCache = new cache({ stdTTL: 3600 }); // Cache TTL of 1 hour

const getHome = async (req, res, next) => {
  try {
    const fetch = (await import('node-fetch')).default; // Dynamic import
    const response = await fetch('https://www.themealdb.com/api/json/v1/1/random.php');
    const data = await response.json();
    const randomDish = data.meals[0];
    res.render("home", { randomDish });
  } catch (error) {
    next(error);
  }
};

const getArea = async (req, res) => {
  try {
    const cachedData = areaCache.get("areaData"); // Use correct cache instance

    if (cachedData) {
      return res.render("area", { data: cachedData });
    }

    const fetch = (await import("node-fetch")).default; // Dynamic import
    const areaResponse = await fetch("https://www.themealdb.com/api/json/v1/1/list.php?a=list");

    if (!areaResponse.ok) {
      const errorText = await areaResponse.text();
      throw new Error(`Failed to fetch area data: ${errorText}`);
    }

    const areaData = await areaResponse.json();
    if (!areaData || !areaData.meals) {
      throw new Error("Failed to fetch area data");
    }

    const filteredAreas = areaData.meals.filter(
      (element) => element.strArea && element.strArea !== "Unknown"
    );

    const promises = filteredAreas.map(async (element) => {
      const nametosearch = `${element.strArea} food`;
      const imageResponse = await fetch(`https://api.unsplash.com/search/photos?page=1&query=${nametosearch}&per_page=1&client_id=${process.env.UNSPLASH_CLIENT_ID}`);

      if (!imageResponse.ok) {
        const errorText = await imageResponse.text();
        console.error(`Unsplash API error: ${errorText}`);
        return { name: element.strArea, image: "" };
      }

      const imageData = await imageResponse.json();
      const imageUrl = imageData.results[0]?.urls.regular || "";

      return { name: element.strArea, image: imageUrl };
    });

    const data = await Promise.all(promises);

    areaCache.set("areaData", data); // Cache the data
    res.render("area", { data });
  } catch (error) {
    console.error("Error fetching data:", error.message);
    res.status(500).send("An error occurred while fetching data.");
  }
};

const getAccount = async (req, res) => {
  const user = await userModel.findOne({ email: req.user.email });
  res.render("profile", { user });
};





module.exports = {
  getHome,
  getArea,
  getAccount,
  



};
