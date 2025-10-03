const mongoose = require("mongoose");

const commentSchema = mongoose.Schema({
  commented_user: { type: mongoose.Schema.ObjectId, ref: "User" }, // Correct field name
  Comment: String,
  date: { type: Date, default: Date.now }
});

const postSchema = mongoose.Schema({
  strMeal: String,
   strMealThumb: String,
   dishIngredients: String,
   dishDescription: String,
   strYoutube: String,
   strInstructions: String,
   strCategory: String,
   cloudinary_id: {
  type: String,
  required: false
}
,
  comments: [commentSchema], // Comments array
  user: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  total_likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  }],
  commented_user: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  }],
});

module.exports = mongoose.model("Post", postSchema);
const Comment = mongoose.model('Comment', commentSchema);
