const express = require("express");
const path = require("path");
const NodeCache = require("node-cache");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const fs = require('fs');


const isLoggedIn = require('./middlewares/isLoggedIn');

const cors = require('cors');

const userModel = require("./models/user");
const postModel = require("./models/post");
const upload = require('./config/multerconfig');

const app = express();
const cache = new NodeCache({ stdTTL: 3600 }); // Cache TTL of 1 hour

app.set("view engine", "ejs");
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors());

/*****************/

const signupRoute = require("./routes/signup");
const homeRoutes = require("./routes/homeRoutes");
const placeRoutes=require('./routes/places');
const recipeRoutes=require('./routes/recipeRoutes');
/***************/


app.use('/home', homeRoutes);
app.use('/home/recipe', recipeRoutes);
app.use("/", signupRoute);
app.get("/alive", (req, res) => {
  res.send("server is running");
});
app.post("/register", async (req, res) => {
  let { name, email, password } = req.body;
  const existingUser = await userModel.findOne({ email });
  if (existingUser) {
    return res.json({ error: "This email is already registered!" });
  }


  bcrypt.genSalt(10, (err, salt) => {
    bcrypt.hash(password, salt, async (err, hash) => {
      let user = await userModel.create({
        name,
        email,
        password: hash,
      });
      console.log(req.body)

      let token = jwt.sign({ email, userid: user._id }, "shhhhh");
      res.cookie("token", token);
      res.json({ success: "Registration successful!" });
    });
  });
});













app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  console.log(password)

  try {
    const user = await userModel.findOne({ email });
    if (user) {
      bcrypt.compare(password, user.password, (err, result) => {
        if (result) {
          const token = jwt.sign({ email, userid: user._id }, "shhhhh");
          res.cookie("token", token);
          res.status(200).send({ success: true, message: "Login successful", token });
        } else {
          res.status(401).send({ success: false, error: "Invalid Credentials" });
        }
      });
    } else {
      res.status(401).send({ success: false, error: "Invalid Credentials" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).send({ success: false, error: "Server error" });
  }
});

app.use("/places", placeRoutes);


app.post("/recipe/item", async (req, res) => {
  const key = req.body.dish;

  // Check if data is in cache
  if (cache.has(key)) {
    const dishData = cache.get(key);
    return res.render("recipesearch", { dishData });
  }

  // If not in cache, fetch data from API
  try {
    const dishResponse = await fetch(
      `https://www.themealdb.com/api/json/v1/1/search.php?s=${key}`
    );
    const dishes = await dishResponse.json();
    const dishData = dishes.meals;

    // Store the fetched data in cache
    cache.set(key, dishData);
    dishData.forEach((dish) => {
      dish.area = key;
    });

    res.render("recipesearch", { dishData });
  } catch (error) {
    console.error(error);
    res.status(500).send("An error occurred while fetching data.");
  }
});


app.get('/recipe/item/:id', isLoggedIn, async (req, res) => {
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
dishIngredients: localRecipe.dishIngredients.split('.'),
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





// POST request to save or remove a dish
app.post('/saveDish', isLoggedIn, async (req, res) => {
  let { dishId } = req.body;  // Change 'id' to 'dishId' here for consistency
  console.log(dishId);  // Logging the dishId

  try {
    // Find the user by email
    let user = await userModel.findOne({ email: req.user.email });

    // Check if the dish ID is already in the user's saved list
    const index = user.savedPost.indexOf(dishId);

    if (index === -1) {
      // If not found, add it to the list
      user.savedPost.push(dishId);
    } else {
      // If found, remove it from the list
      user.savedPost.splice(index, 1);
    }

    // Save the updated user data
    await user.save();

    // Send a success response
    res.status(200).json({ message: user });
  } catch (error) {
    // Handle errors
    console.error('Error saving dish:', error);
    res.status(500).json({ error: 'Failed to save dish' });
  }
});


app.post('/unSaveDish', isLoggedIn, async (req, res) => {
  try {

    const { dishId } = req.body;

    // Find the user by email
    let user = await userModel.findOne({ email: req.user.email });

    // Check if the dish ID is already in the user's saved list
    const index = user.savedPost.indexOf(dishId);


    // If found, remove it from the list
    user.savedPost.splice(index, 1);


    // Save the updated user data
    await user.save();

    // Send a success response
    res.status(200).json({ message: user });
  } catch (error) {
    // Handle errors
    console.error('Error saving dish:', error);
    res.status(500).json({ error: 'Failed to save dish' });
  }
});



app.get("/account/addDish", isLoggedIn, (req, res) => {
  res.render('addDish');
})
app.get('/account/userSavedRecipe', isLoggedIn, async (req, res) => {
  try {
    let user = await userModel.findOne({
      email: req.user.email
    });

    console.log((user.savedPost));

    let recipes = [];
    for (let id of user.savedPost) {
      if (id.length > 8) {
        let recipe = await postModel.findById(id);
        recipes.push(recipe);
        console.log(recipe._id);

      } else {

        try {
          const recipeResponse = await fetch(
            `https://www.themealdb.com/api/json/v1/1/lookup.php?i=${id}`
          );
          const recipe = await recipeResponse.json();

          const data = recipe.meals[0];
          recipes.push(data);
        } catch (error) {
          console.error(`Error fetching recipe with id ${id}:`, error);
        }
      }
    }



    res.render('savedPost', { recipes });
  } catch (error) {
    console.error(error);
    res.status(500).send("An error occurred while fetching data.");
  }
});

app.get('/account/postcreated', isLoggedIn, async (req, res) => {
  let user = await userModel.findOne({ email: req.user.email }).populate('post');
  let post = (user.post);

  res.render('createdPost', { post });
});

app.post('/account/dishUpload', isLoggedIn, upload.single('dishImage'), async (req, res) => {
  const { email } = req.user;
  const user = await userModel.findOne({ email });

  const imageUrl = req.file?.path || req.file?.secure_url || req.file?.url;
  const publicId = req.file?.public_id || req.file?.filename;

  const { dishName, dishIngredients, dishInstructions, dishDescription, dishYouTubeLink, dishCategory } = req.body;

  let postcreated = await postModel.create({
    strMeal: dishName,
    strMealThumb: imageUrl,
    strMealThumbPublicId: publicId,
    dishIngredients,
    dishDescription,
    strYoutube: dishYouTubeLink,
    strInstructions: dishInstructions,
    strCategory: dishCategory,
  });

  // attach post -> user
  postcreated.user.push(user._id);
  await postcreated.save();
  user.post.push(postcreated._id);
  await user.save();

  res.redirect('/account/addDish');
});





app.get('/postDelete/:id', isLoggedIn, async (req, res) => {
  const deletedPost = await postModel.findOneAndDelete({ _id: req.params.id });

  // remove reference from user
  const user = await userModel.findOne({ email: req.user.email });
  const idx = user.post.indexOf(deletedPost._id);
  if (idx > -1) { user.post.splice(idx, 1); await user.save(); }

  // delete from Cloudinary if we have the public id
  if (deletedPost?.strMealThumbPublicId) {
    try {
      await cloudinary.uploader.destroy(deletedPost.strMealThumbPublicId);
    } catch (err) { console.error('Cloudinary delete error', err); }
  }

  res.redirect('/account/postcreated');
});


app.get('/postEdit/:id', isLoggedIn, async (req, res) => {
  let post = await postModel.findOne({
    _id: req.params.id
  })


  res.render('editDish', { post })


});


app.post('/editDish/:id', isLoggedIn, upload.single('dishImage'), async (req, res) => {
  const post = await postModel.findById(req.params.id);

  const updatedData = {
    dishName: req.body.dishName,
    dishCategory: req.body.dishCategory,
    dishIngredients: req.body.dishIngredients,
    dishInstructions: req.body.dishInstructions,
    dishDescription: req.body.dishDescription,
    dishYouTubeLink: req.body.dishYouTubeLink,
  };

  if (req.file) {
    // delete previous image
    if (post?.strMealThumbPublicId) {
      await cloudinary.uploader.destroy(post.strMealThumbPublicId);
    }
    updatedData.strMealThumb = req.file?.path || req.file?.secure_url || req.file?.url;
    updatedData.strMealThumbPublicId = req.file?.public_id || req.file?.filename;
  }

  await postModel.findByIdAndUpdate(req.params.id, updatedData, { new: true });
  res.redirect('/account/postcreated');
});

app.get('/seeRecipe/:id', isLoggedIn, async (req, res) => {
  let user = await userModel.findOne({
    email: req.user.email
  });
  const postId = req.params.id;
  let postData = await postModel.findOne({
    _id: req.params.id
  }).populate(["user", "comments.commented_user"]);

  const userData = (postData.user);

  ingredients = (postData.dishIngredients).split('.');

  instruction = (postData.dishInstructions).split('.\r\n');
  console.log(postData.total_likes.length);



  res.render('userRecipe', { postData, ingredients, instruction, userData, postId, user });

});
app.post('/likeUpdate', isLoggedIn, async (req, res) => {
  try {

    // Find the logged-in user by email
    let user = await userModel.findOne({
      email: req.user.email
    });

    // Find the recipe by id
    let post = await postModel.findOne({
      _id: req.body.postid
    });


    let index = post.total_likes.indexOf(user._id);
    console.log(index)
    if (index == -1) {
      post.total_likes.push(user._id);
      await post.save();
    }
    else {
      post.total_likes.splice(index, 1);
      await post.save();
    }

    res.status(200).json({ message: post.total_likes.length });
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});
app.post('/comments', isLoggedIn, async (req, res) => {
  try {
    let user = await userModel.findOne({ email: req.user.email });

    let updatedPost = await postModel.findOneAndUpdate(
      { _id: req.body.postId },
      {
        $push: {
          comments: {
            commented_user: user._id, // Use commented_user as per schema
            Comment: req.body.comment.trim(),
          },
        },
      },
      { new: true }
    ).populate('comments.commented_user'); // Populate commented_user field in comments



    res.status(200).json(updatedPost);
  } catch (error) {
    console.error("Error updating post with comment:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});








app.get('/getCategory', async (req, res) => {
  try {
    const posts = await postModel.find();
    const categories = posts.map(m => m.dishCategory);
    const combinedIngredients = categories.join(',').split(',');
    res.json(combinedIngredients);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching categories");
  }
});
app.post('/getDishListAsPerCategory', async (req, res) => {
  try {
    const posts = await postModel.find();
    const cat = req.body.category.trim();
    const filteredPosts = posts.filter(post => {
      const dishCategories = post.dishCategory.split(',').map(c => c.trim());
      return dishCategories.includes(cat);
    });

    res.json(filteredPosts);
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).send('Error fetching data');
  }
});

app.post("/updateProfile", upload.single('profileImage'), async (req, res) => {
  const imageUrl = req.file?.path || req.file?.secure_url || req.file?.url;
  const publicId = req.file?.public_id || req.file?.filename;

  const user = await userModel.findByIdAndUpdate(
    req.body.id,
    { profilePic: imageUrl, profilePicPublicId: publicId },
    { new: true }
  );

  res.status(200).json({ message: "Profile updated successfully", user });
});




app.post('/allUserPost/ingredient', async (req, res) => {
  try {
    const { ingredient } = req.body;
    if (!ingredient) {
      return res.status(400).json({ error: "Ingredient is required" });
    }

    // 1️⃣ Fetch your own recipes from MongoDB
    const recipes = await postModel.find();
 
    const filteredLocal = recipes.filter(recipe => {
      const ingArr = recipe.dishIngredients
        .split(/[\n,.]/)
        .map(i => i.trim().toLowerCase());
      return ingArr.some(i => i.includes(ingredient.toLowerCase()));
    });
   
    
      
    // Map to MealDB format
    const mappedLocal = filteredLocal.map(recipe => ({
      strMeal: recipe.strMeal,
     strMealThumb: recipe.strMealThumb, // already a URL from DB

      idMeal: recipe._id.toString()
    }));

    // 2️⃣ Fetch third-party MealDB API
    const response = await fetch(`https://www.themealdb.com/api/json/v1/1/filter.php?i=${ingredient}`);
    const mealDBData = await response.json();
    const mealsFromAPI = mealDBData.meals || []; // ensure it's an array

    // 3️⃣ Merge both results
    const mergedResults = [...mappedLocal, ...mealsFromAPI];
    console.log(mergedResults)
    res.json(mergedResults);

  } catch (err) {
    console.error("Error fetching recipes:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});



app.get('/viewProfile/:id', async (req, res) => {

  console.log(req.params.id);

  const user = await userModel.findById(req.params.id).populate('post');
  console.log(user);


  res.render('viewProfile', { user })


});

















app.get('/logout', (req, res) => {
  res.cookie('token', '');
  res.redirect('/');
});

app.get('/delete', isLoggedIn, async (req, res) => {
  try {

    let user = await userModel.findByIdAndDelete(req.user.userid);

    if (!user) {
      console.log('User not found');
      return res.status(404).send('User not found');
    }

    console.log('Account deleted successfully:', user);
    res.cookie('token', '', { maxAge: 0 });
    res.render('deleted');
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).send('Internal Server Error');
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




// Example usage:
// run("chicken, garlic, onion, tomato", "Italy", "Chicken Alfredo", "javascript");




// Example usage
// run("chicken, onion, garlic", "Italy", "javascript");

// run();

app.get("/aiform", (req, res) => {
  res.render("form");
});




app.post("/aiResponse", async (req, res) => {
  const {ingredients, language,cuisine, dishName} = req.body;
  const recipeObject = await run(ingredients, language,cuisine, dishName);
  if (recipeObject) {
    res.json( { recipeObject });
  } else {
    res.status(500).send("Failed to generate recipe."); // Handle the error gracefully
  }
});

/************************************************************* */

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
