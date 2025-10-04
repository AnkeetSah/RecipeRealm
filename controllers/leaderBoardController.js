const userModel = require('../models/user');


const getLeaderBoard = async (req, res) => {
  try {
    const users = await userModel.find().populate({
      path: 'post',
      select: 'total_likes'
    });

    const leaderBoard = users.map(user => ({
      name: user.name,
      pic: user.profilePic,
      id: user._id,
      total_likes: user.post.reduce((total, post) => total + post.total_likes.length, 0)
    }));

    leaderBoard.sort((a, b) => b.total_likes - a.total_likes);
    
    res.render('leaderBoard', { leaderBoard });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching leaderboard data");
  }
};

module.exports = {
  getLeaderBoard
};