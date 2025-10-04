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


app.post('/api/like', async (req, res) => {
  try {
    const { postId, userId } = req.body;
  console.log(req.body)
    const post = await postModel.findById(postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    // Prevent duplicate likes
    if (!post.total_likes.includes(userId)) {
      post.total_likes.push(userId);
      await post.save();
    }

    res.status(200).json({ message: "Like updated", totalLikes: post.total_likes.length });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

app.post('/api/unlike', async (req, res) => {
  try {
    console.log('=== UNLIKE API CALL ===');
    console.log('Request body:', req.body);
    
    const { postId, userId } = req.body;

    // Input validation
    if (!postId) {
      return res.status(400).json({ message: "postId is required" });
    }
    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }

    // Find the post
    const post = await postModel.findById(postId);
    if (!post) {
      console.log('Post not found with ID:', postId);
      return res.status(404).json({ message: "Post not found" });
    }

    console.log('Post found:', {
      id: post._id,
      title: post.strMeal || post.dishName,
      currentLikes: post.total_likes,
      currentLikesCount: post.total_likes.length
    });

    // Convert to string for consistent comparison
    const userIdStr = userId.toString();
    
    // Check if user has liked the post
    const initialLength = post.total_likes.length;
    
    // Filter out the user ID
    post.total_likes = post.total_likes.filter(
      likeId => likeId.toString() !== userIdStr
    );

    // Check if anything was actually removed
    if (post.total_likes.length < initialLength) {
      await post.save();
      console.log('Post after unlike:', {
        newLikes: post.total_likes,
        newLikesCount: post.total_likes.length
      });
      
      return res.status(200).json({ 
        message: "Unlike successful", 
        totalLikes: post.total_likes.length 
      });
    } else {
      console.log('User had not liked this post');
      return res.status(200).json({ 
        message: "User had not liked this post", 
        totalLikes: post.total_likes.length 
      });
    }

  } catch (error) {
    console.error('Unlike API Error:', error);
    res.status(500).json({ 
      message: "Server error",
      error: error.message 
    });
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
