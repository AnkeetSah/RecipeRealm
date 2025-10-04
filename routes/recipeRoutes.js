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

    // Logged-in user
    user = await userModel.findOne({ email: req.user.email });

    if (isMongoDBId) {
      // Fetch local recipe and populate user
      localRecipe = await postModel.findById(id).populate("user");

      if (localRecipe) {
        data = {
          idMeal: localRecipe._id?.toString(),
          strMeal: localRecipe.strMeal,
          strMealThumb: localRecipe.strMealThumb,
          strInstructions: localRecipe.strInstructions || localRecipe.dishDescription,
          strYoutube: localRecipe.strYoutube,
          strCategory: localRecipe.strCategory,
          dishIngredients: localRecipe.dishIngredients.split(','),

          // Custom marker for local recipes
          strArea: 'Custom',

          // Include recipe owner
          createdBy: localRecipe.user?.[0] ? {
            id: localRecipe.user[0]._id,
            name: localRecipe.user[0].name,
            email: localRecipe.user[0].email,
            profilePic: localRecipe.user[0].profilePic
          } : null,

          // Extra local-only fields
          total_likes: localRecipe.total_likes,
          commented_user: localRecipe.commented_user,
          comments: localRecipe.comments
        };
      }
    }
    console.log(data)

    // If no local recipe found, fallback to third-party API
    if (!data) {
      try {
        const recipeResponse = await fetch(`https://www.themealdb.com/api/json/v1/1/lookup.php?i=${id}`);
        if (recipeResponse.ok) {
          const recipe = await recipeResponse.json();
          data = recipe?.meals?.[0] || null;
        }
      } catch (apiError) {
        console.error('Error fetching from external API:', apiError);
      }
    }

    // If nothing found
    if (!data) {
      return res.status(404).send("Recipe not found");
    }

    console.log('Final data:', data);

    // Render recipe with logged-in user + recipe data
    res.render("recipe", { data,user});

  } catch (error) {
    console.error('Error fetching recipe:', error);
    res.status(500).send("An error occurred while fetching data.");
  }
});

// ✅ CORRECT: Proper route with error handling and response
router.get('/allPost', async (req, res) => {
  try {
    const recipes = await postModel.find();
    console.log('Found recipes:', recipes.length);
    
    // Send the recipes back to the client
    res.status(200).json({
      success: true,
      message: 'Recipes fetched successfully',
      data: recipes,
      count: recipes.length
    });
    
  } catch (error) {
    console.error('Error fetching recipes:', error);
    
    // Send error response
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recipes',
      error: error.message
    });
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
