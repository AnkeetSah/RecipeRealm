const mongoose = require("mongoose");
require("dotenv").config(); // Load environment variables

mongoose.connect(process.env.MONGO_URI);

const userSchema = mongoose.Schema({
  email: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  password: { type: String, required: true },
  savedPost: [String],
  profilePic: String,           // Cloudinary secure URL
  cloudinary_id: String,        // Cloudinary public_id for profile pic
  post: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
    },
  ],
});

module.exports = mongoose.model("User", userSchema);
