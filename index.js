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

/***************/


app.use('/home', homeRoutes);
app.use("/", signupRoute);

app.post("/register", (req, res) => {
  let { name, email, password } = req.body;
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
      res.status(200).redirect("/home");
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



app.get("/places/:areaname", async (req, res) => {
  const key = req.params.areaname;

  // Check if data is in cache
  if (cache.has(key)) {
    const dishData = cache.get(key);
    dishData.map((dishData) => {
      dishData.area = key;
    });
    return res.render("areadish", { dishData });
  }

  // If not in cache, fetch data from API
  try {
    const fetch = await import("node-fetch");
    const dishResponse = await fetch.default(
      `https://www.themealdb.com/api/json/v1/1/filter.php?a=${key}`
    );
    const dishes = await dishResponse.json();
    const dishData = dishes.meals;

    // 5640ca91a659c972cf2247fea42e5f8b	
    // 379a75d9

    // Store the fetched data in cache
    cache.set(key, dishData);
    dishData.map((dishData) => {
      dishData.area = key;
    });

    res.render("areadish", { dishData });
  } catch (error) {
    console.error(error);
    res.status(500).send("An error occurred while fetching data.");
  }
});


app.get("/places/:areaname/:id", isLoggedIn, async (req, res) => {

  let user = await userModel.findOne({
    email: req.user.email
  });


  let id = req.params.id;



  // If not in cache, fetch data from API
  try {
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
});


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
  let id = req.params.id;
  let user = await userModel.findOne({
    email: req.user.email
  });


  // If not in cache, fetch data from API
  try {
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
app.post('/account/dishUpload', isLoggedIn, upload.single("dishImage"), async (req, res) => {
  let { email, userid } = req.user;
  let user = await userModel.findOne({
    email: email
  });

  let { filename, } = (req.file);
  let { dishName, dishIngredients, dishInstructions, dishDescription, dishYouTubeLink, dishCategory } = req.body;
  let postcreated = await postModel.create({
    dishName,
    filename,
    dishIngredients,
    dishDescription,
    dishYouTubeLink,
    dishInstructions,
    dishCategory,
  });
  postcreated.user.push(user._id);
  await postcreated.save();

  user.post.push(postcreated._id);
  await user.save();


  res.redirect('/account/addDish');
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
app.get('/postEdit/:id', isLoggedIn, async (req, res) => {
  let post = await postModel.findOne({
    _id: req.params.id
  })


  res.render('editDish', { post })


});
app.post('/editDish/:id', isLoggedIn, upload.single('dishImage'), async (req, res) => {

  try {
    let updatedData = {
      dishName: req.body.dishName,
      dishCategory: req.body.dishCategory,
      dishIngredients: req.body.dishIngredients,
      dishInstructions: req.body.dishInstructions,
      dishDescription: req.body.dishDescription,
      dishYouTubeLink: req.body.dishYouTubeLink,
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



app.get('/allUserPost', async (req, res) => {
  const post = await postModel.find();
  res.send(post);
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
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
console.log(process.env.GEMINI_API_KEY);
async function run(dish, country, language) {
  const text = `You have to act like world best chief I have the following ingredients: ${dish} for country ${country}. Can you suggest a recipe that uses most or all of these ingredients? Please include:
The dish name,
    A list of additional ingredients if needed with there measurement having key name as measurement,
        Step-by-step instructions,
            Tips for cooking or substitutions it should be like this [
    "If you don't have sesame oil, you can use olive oil or vegetable oil.",
    "If you don't have soy sauce, you can use tamari or a low-sodium soy sauce.",
    "If you don't like ginger, you can omit it or substitute it with 1/4 teaspoon of ground ginger."
  ],
            Nutritional information of the meal as array like this [
    "calories: 350",
    "protein: 25 grams",
    "carbohydrates: 40 grams",
    "fat: 10 grams"
  ],
                An estimated cooking time.

Focus on creating a flavorful and easy-to-make dish!
give the response in different section give the response in braces for each section like dishname in one braces ingredients in another braces and 

instruction in another braces tips another braces substitution another braces cooking time in another Nutritional information in another braces

give the response in form of javascript object in ${language}
 language all in small letter and camel case and plural use instructions tips substitutions all in small letter only give the response and dont say anything in the begning just give the result `;
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const result = await model.generateContent([text]);
  const recipeText = result.response.text();
  console.log(recipeText)
  const cleanedRecipeText = recipeText
    .replace(/```(?:javascript|json)?\s*/g, "")  // Removes ```javascript or ```json
    .replace(/\s*```/g, "")  // Removes closing ```
    .replace(/,\s*([}\]])/g, "$1") // Remove trailing commas before closing braces/brackets
    .trim();

  try {
    const recipeObject = JSON.parse(cleanedRecipeText);
    // fs.writeFileSync("recipe.txt", JSON.stringify(recipeObject, null, 2), "utf8");
    console.log(recipeObject);
    console.log("Recipe saved to recipe.json");
    return recipeObject;
  } catch (error) {
    ``
    console.error("Error parsing recipe text:", error);
    console.error("Response received:", cleanedRecipeText); // Log the problematic response
  }

}
// run();

app.get("/aiform", (req, res) => {
  res.render("form");
});

app.post("/aiResponse", async (req, res) => {
  const { dish, language, country } = req.body;
  const recipeObject = await run(dish, country, language);
  if (recipeObject) {
    res.render("recipe1", { recipeObject });
  } else {
    res.status(500).send("Failed to generate recipe."); // Handle the error gracefully
  }
});

/************************************************************* */

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
