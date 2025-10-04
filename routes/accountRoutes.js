const express = require('express');
const userModel = require("../models/user");
const router=express.Router()
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const isLoggedIn =require('../middlewares/isLoggedIn')

const postModel = require("../models/post");
const { cloudinary, upload } = require("../config/cloudinaryConfig");

router.post("/register", async (req, res) => {
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

router.post("/login", async (req, res) => {
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


router.get('/logout', (req, res) => {
  res.cookie('token', '');
  res.redirect('/');
});

router.get('/delete', isLoggedIn, async (req, res) => {
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





router.get("/addDish", isLoggedIn, (req, res) => {
  res.render('addDish');
})

router.get('/postEdit/:id', isLoggedIn, async (req, res) => {
  let post = await postModel.findOne({
    _id: req.params.id
  })
  res.render('editDish', { post })
});





router.get('/userSavedRecipe', isLoggedIn, async (req, res) => {
  try {
    const user = await userModel.findOne({ email: req.user.email });
    const savedPosts = user.savedPost || [];

    const recipePromises = savedPosts.map(async (id) => {
      if (id.length > 8) {
        // Internal DB recipe
        return postModel.findById(id);
      } else {
        // External API recipe
        try {
          const response = await fetch(
            `https://www.themealdb.com/api/json/v1/1/lookup.php?i=${id}`
          );
          const data = await response.json();
          return data.meals[0];
        } catch (error) {
          console.error(`Error fetching recipe with id ${id}:`, error);
          return null;
        }
      }
    });

    const recipes = await Promise.all(recipePromises);

    // Filter out any failed fetches (nulls)
    res.render('savedPost', { recipes: recipes.filter(Boolean) });
  } catch (error) {
    console.error(error);
    res.status(500).send("An error occurred while fetching data.");
  }
});

router.post("/unsaveDish", isLoggedIn, async (req, res) => {
  try {
    const { id } = req.body;

    // Find the user
    const user = await userModel.findOne({ email: req.user.email });
    if (!user) return res.status(404).json({ message: "User not found" });

    // Remove the id from savedPost
    user.savedPost = (user.savedPost || []).filter(postId => postId !== id);

    // Save the updated user
    await user.save();

    res.json({ message: "Dish removed from saved posts successfully", savedPost: user.savedPost });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "An error occurred while unsaving the dish" });
  }
});



router.get('/postcreated', isLoggedIn, async (req, res) => {
  let user = await userModel.findOne({ email: req.user.email }).populate('post');
  let posts = (user.post);
  console.log(posts)

  res.render('createdPost', { posts });
});


router.post('/dishUpload', isLoggedIn, upload.single("dishImage"), async (req, res) => {
  let { email } = req.user;
  let user = await userModel.findOne({ email });

  // Get Cloudinary image details
  let imageUrl = req.file.path;        // Cloudinary secure URL
  let publicId = req.file.filename;    // Cloudinary public_id

  let { dishName, dishIngredients, dishInstructions, dishDescription, dishYouTubeLink, dishCategory } = req.body;

  let postcreated = await postModel.create({
    strMeal: dishName,
    strMealThumb: imageUrl,  // ✅ Store Cloudinary URL instead of local filename
    cloudinary_id: publicId, // optional (for deleting/updating later)
    dishIngredients,
    dishDescription,
    strYoutube: dishYouTubeLink,
    strInstructions: dishInstructions,
    strCategory: dishCategory,
  });

  postcreated.user.push(user._id);
  await postcreated.save();

  user.post.push(postcreated._id);
  await user.save();

  res.redirect('/account/addDish');
});


router.post('/editDish/:id', isLoggedIn, upload.single('dishImage'), async (req, res) => {
  try {
    const postId = req.params.id;
    const post = await postModel.findById(postId);

    if (!post) {
      return res.status(404).send('Dish not found');
    }

    // Update the text fields
    post.strMeal = req.body.strMeal;
    post.strCategory = req.body.strCategory;
    post.dishIngredients = req.body.dishIngredients;
    post.strInstructions = req.body.strInstructions;
    post.dishDescription = req.body.dishDescription;
    post.strYoutube = req.body.strYoutube;

    // Update image if a new file is uploaded
    if (req.file) {
      // Delete the old image from Cloudinary
      if (post.cloudinary_id) {
        await cloudinary.uploader.destroy(post.cloudinary_id);
      }

      // Save the new image details
      post.strMealThumb = req.file.path;       // Cloudinary secure URL
      post.cloudinary_id = req.file.filename;  // Cloudinary public_id
    }

    await post.save();

    res.redirect('/account/postcreated');
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});


router.post("/updateProfile", isLoggedIn, upload.single('profileImage'), async (req, res) => {
  try {
    const userId = req.body.id;
    if (!userId) return res.status(400).json({ message: "User ID is required" });

    const user = await userModel.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // If a new profile image is uploaded
    if (req.file) {
      // Delete old profile pic from Cloudinary if exists
      if (user.cloudinary_id) {
        try {
          await cloudinary.uploader.destroy(user.cloudinary_id);
          console.log("Old profile image deleted from Cloudinary");
        } catch (err) {
          console.error("Error deleting old profile image:", err);
        }
      }

      // Update user with new Cloudinary image details
      user.profilePic = req.file.path;       // Cloudinary secure URL
      user.cloudinary_id = req.file.filename; // Cloudinary public_id
    }

    // Update other fields if provided
    if (req.body.name) user.name = req.body.name;
    if (req.body.email) user.email = req.body.email;

    await user.save();

    res.status(200).json({
      message: "Profile updated successfully",
      user,
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});



router.get('/postDelete/:id', isLoggedIn, async (req, res) => {
  try {
    // Find and delete the post
    let deletedPost = await postModel.findOneAndDelete({ _id: req.params.id });
    if (!deletedPost) {
      return res.status(404).send('Post not found');
    }

    // Remove the post from the user's post array
    let user = await userModel.findOne({ email: req.user.email });
    if (!user) {
      return res.status(404).send('User not found');
    }

    user.post = (user.post || []).filter(postId => postId.toString() !== deletedPost._id.toString());
    await user.save();

    // Delete the image from Cloudinary if exists
    if (deletedPost.cloudinary_id) {
      try {
        await cloudinary.uploader.destroy(deletedPost.cloudinary_id);
        console.log('Image deleted from Cloudinary successfully');
      } catch (err) {
        console.error('Error deleting image from Cloudinary:', err);
      }
    }

    console.log('Deleted post:', deletedPost);
    res.redirect('/account/postcreated');
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});





module.exports=router