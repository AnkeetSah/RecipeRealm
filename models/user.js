const mongoose = require("mongoose");
require("dotenv").config(); // Load environment variables

mongoose.connect(process.env.MONGO_URI);

const userSchema = mongoose.Schema({
  email: String,
  name: String,
  password: String,
  savedPost: [String],
  profilePic: String,
  post: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
    },
  ],
});

module.exports = mongoose.model("User", userSchema);
