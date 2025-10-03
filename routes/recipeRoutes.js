const express = require('express');
const router = express.Router();
const isLoggedIn = require('../middlewares/isLoggedIn');
const userModel = require("../models/user");
const postModel=require("../models/post")
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

router.get('/item/:id', isLoggedIn, async (req, res) => {
  const id = req.params.id;
  
  try {
    // First, check if ID is a MongoDB ObjectId (24 hex characters)
    const isMongoDBId = /^[0-9a-fA-F]{24}$/.test(id);
    
    let user = null;
    let localRecipe = null;
    let data = null;
    
    // Get user data
    user = await userModel.findOne({ email: req.user.email });
    
    if (isMongoDBId) {
      // Only try to find in database if it's a valid MongoDB ID
      localRecipe = await postModel.findById(id);
      
      if (localRecipe) {
        // Use local database recipe
        data = {
          idMeal: localRecipe._id?.toString(),
          strMeal: localRecipe.strMeal,
          strMealThumb: localRecipe.strMealThumb,
          strInstructions: localRecipe.strInstructions || localRecipe.dishDescription,
          strYoutube: localRecipe.strYoutube,
          strCategory: localRecipe.strCategory,
dishIngredients: localRecipe.dishIngredients.split(','),
 // Include this for frontend
          strArea: 'Custom',
          // Add empty ingredient fields to match external API structure
          strIngredient1: '',
          strMeasure1: ''
        };
      }
    }console.log(data)
    
    // If no local recipe found (either not MongoDB ID or not found in DB), try external API
    if (!data) {
      try {
        const recipeResponse = await fetch(`https://www.themealdb.com/api/json/v1/1/lookup.php?i=${id}`);
        if (recipeResponse.ok) {
          const recipe = await recipeResponse.json();
          data = recipe?.meals?.[0];
        }
      } catch (apiError) {
        console.error('Error fetching from external API:', apiError);
      }
    }
    
    // If no data found from either source
    if (!data) {
      return res.status(404).send("Recipe not found");
    }
    
    console.log('Final data:', data);
    res.render("recipe", { data, user: user || {} });
    
  } catch (error) {
    console.error('Error fetching recipe:', error);
    res.status(500).send("An error occurred while fetching data.");
  }
});



/**************************************************************************************************** */
require("dotenv").config();
const { GoogleGenAI } = require("@google/genai");

// Initialize the client; API key is taken from GEMINI_API_KEY environment variable
const ai = new GoogleGenAI({});

// Utility: remove markdown-style characters
function sanitizeText(text) {
  if (!text) return "";
  return text
    .replace(/\*\*/g, "") // remove **
    .replace(/\*/g, "")   // remove *
    .replace(/[_`#>-]/g, ""); // remove other markdown symbols
}

async function run(ingredients, language, cuisine, dishName) {
  const hasDishName = dishName && dishName.trim() !== "";

  const prompt = `
You are a professional chef and recipe writer. 
Return ONLY a valid JSON object (with double-quoted keys + values). 
Do not include explanations, greetings, or markdown. 
The structure must be:

{
  "dishName": "string",
  "ingredients": [
    { "item": "string", "measurement": "string" }
  ],
  "instructions": ["Step 1 ...", "Step 2 ..."],
  "tips": ["Tip 1 ...", "Tip 2 ..."],
  "cookingTime": "string",
  "nutritionalInformation": [
    "calories: 350",
    "protein: 25 grams",
    "carbohydrates: 40 grams",
    "fat: 10 grams"
  ]
}

Now generate the recipe for:
Cuisine: ${cuisine} 
Dish: ${hasDishName ? dishName : "Suggest a dish with my ingredients"} 
Ingredients I have: ${ingredients}
Language: ${language}
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    let recipeText = response.text
      .replace(/```[\s\S]*?```/g, "") // remove code fences
      .replace(/,\s*([}\]])/g, "$1") // remove trailing commas
      .replace(/[“”]/g, '"') // fix curly quotes
      .replace(/[‘’]/g, "'") // fix curly single quotes
      .trim();

    // Auto-fix unquoted keys (JS -> JSON)
    recipeText = recipeText.replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');

    // ✅ Sanitize before parsing
    recipeText = sanitizeText(recipeText);

    const recipeObject = JSON.parse(recipeText);

    // ✅ Sanitize parsed fields too
    if (recipeObject.dishName) recipeObject.dishName = sanitizeText(recipeObject.dishName);
    if (Array.isArray(recipeObject.ingredients)) {
      recipeObject.ingredients = recipeObject.ingredients.map((ing) => ({
        item: sanitizeText(ing.item),
        measurement: sanitizeText(ing.measurement),
      }));
    }
    if (Array.isArray(recipeObject.instructions)) {
      recipeObject.instructions = recipeObject.instructions.map(sanitizeText);
    }
    if (Array.isArray(recipeObject.tips)) {
      recipeObject.tips = recipeObject.tips.map(sanitizeText);
    }
    if (recipeObject.cookingTime) recipeObject.cookingTime = sanitizeText(recipeObject.cookingTime);
    if (Array.isArray(recipeObject.nutritionalInformation)) {
      recipeObject.nutritionalInformation = recipeObject.nutritionalInformation.map(sanitizeText);
    }

    console.log("✅ Parsed recipe object:\n", recipeObject);
    return recipeObject;

  } catch (error) {
    console.error("❌ Error generating or parsing recipe:", error);
    return {
      dishName: hasDishName ? dishName : "Custom Recipe Creation",
      ingredients: [],
      instructions: ["There was an error generating the recipe. Please try again."],
      tips: ["Check your internet connection and try again."],
      cookingTime: "Unknown",
      nutritionalInformation: ["Information not available"]
    };
  }
}





router.post("/aiResponse", async (req, res) => {
  const {ingredients, language,cuisine, dishName} = req.body;
  const recipeObject = await run(ingredients, language,cuisine, dishName);
  if (recipeObject) {
    res.json( { recipeObject });
  } else {
    res.status(500).send("Failed to generate recipe."); // Handle the error gracefully
  }
});


module.exports = router;
