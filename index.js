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
const accountRoutes=require('./routes/accountRoutes')
/***************/


app.use('/home', homeRoutes);
app.use('/home/recipe', recipeRoutes);
app.use("/", signupRoute);
app.use("/places", placeRoutes);
app.use("/account",accountRoutes);




/*
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

*/






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

app.post('/editDish/:id', isLoggedIn, upload.single('dishImage'), async (req, res) => {

  try {
    let updatedData = {
      strMeal: req.body.strMeal,
      strCategory: req.body.strCategory,
      dishIngredients: req.body.dishIngredients,
      strInstructions: req.body.strInstructions,
      dishDescription: req.body.dishDescription,
      strYoutube: req.body.strYoutube,
    };

    if (req.file) {
      updatedData.filename = req.file.filename;
    }

    let updatedPost = await postModel.findByIdAndUpdate(req.params.id, updatedData, { new: true });

    res.redirect('/account/postcreated');
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});


app.get('/postDelete/:id', isLoggedIn, async (req, res) => {
  try {
    let deletedPost = await postModel.findOneAndDelete({ _id: req.params.id });
    if (!deletedPost) {
      return res.status(404).send('Post not found');
    }

    let user = await userModel.findOne({ email: req.user.email });
    if (!user) {
      return res.status(404).send('User not found');
    }

    let postIndex = user.post.indexOf(deletedPost._id);
    if (postIndex > -1) {
      user.post.splice(postIndex, 1);
      await user.save();
    }

    fs.unlink(`./public/images/uploads/${deletedPost.filename}`, (err) => {
      if (err) {
        console.error('Error deleting image:', err);
      } else {
        console.log('Image deleted successfully');
      }
    });


    console.log(deletedPost);
    res.redirect('/account/postcreated');
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
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







/*
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
*/


app.post("/updateProfile", upload.single('profileImage'), async (req, res) => {
  console.log(req.body.id);
  const user = await userModel.findByIdAndUpdate(
    req.body.id,
    { profilePic: req.file.filename },
    { new: true }
  );



  res.status(200).json({
    message: "Profile updated successfully",
  });





})



app.post('/allUserPost/ingredient', async (req, res) => {
  try {
    const { ingredient } = req.body;
    if (!ingredient) {
      return res.status(400).json({ error: "Ingredient is required" });
    }

    // 1️⃣ Fetch your own recipes from MongoDB
    const recipes = await postModel.find();
 
    const filteredLocal = recipes.filter(recipe => {
      const ingArr = recipe.strCategory
        .split(/[\n,.]/)
        .map(i => i.trim().toLowerCase());
      return ingArr.some(i => i.includes(ingredient.toLowerCase()));
    });
   
    
      
    // Map to MealDB format
    const mappedLocal = filteredLocal.map(recipe => ({
      strMeal: recipe.strMeal,
      strMealThumb: recipe.strMealThumb, // adjust if needed
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


app.listen(3000, () => {
  console.log("Server is running on port 3000");
});

app.get("/alive", (req, res) => {
  res.send("server is running");
});
