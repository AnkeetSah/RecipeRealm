/*************************************************************** 
app.get("/home", isLoggedIn, async (req, res, next) => {
  try {
    const fetch = await import("node-fetch");
    const response = await fetch.default('https://www.themealdb.com/api/json/v1/1/random.php');
    const data = await response.json();
    const randomDish = (data.meals[0])
    res.render("home", { randomDish });
  } catch (error) {
    next(error);
  }
});
app.get("/home/area", async (req, res) => {
  try {
    let data = [];
    const cachedData = cache.get("areaData");

    if (cachedData) {
      return res.render("area", { data: cachedData });
    }

    const fetch = await import("node-fetch");

    const areaResponse = await fetch.default(
      "https://www.themealdb.com/api/json/v1/1/list.php?a=list"
    );

    if (!areaResponse.ok) {
      const errorText = await areaResponse.text();
      throw new Error(`Failed to fetch area data: ${errorText}`);
    }

    const areaData = await areaResponse.json();

    if (!areaData || !areaData.meals) {
      throw new Error("Failed to fetch area data");
    }

    const filteredAreas = areaData.meals.filter(
      (element) => element.strArea !== "Unknown"
    );

    const promises = filteredAreas.map(async (element) => {
      const nametosearch = `${element.strArea} food`;
      const imageResponse = await fetch.default(
        `https://api.unsplash.com/search/photos?page=1&query=${nametosearch}&per_page=1&client_id=PWupS2q4P_gypAT3GJyd63To1OwpQJq76JJ0-MXkVzI`
      );

      if (!imageResponse.ok) {
        const errorText = await imageResponse.text();
        console.error(`Unsplash API error: ${errorText}`);
        return { name: element.strArea, image: "" };
      }

      const imageData = await imageResponse.json();

      const imageUrl = imageData.results[0]?.urls.regular || "";

      return { name: element.strArea, image: imageUrl };
    });

    data = await Promise.all(promises);

    cache.set("areaData", data);
    res.render("area", { data });
  } catch (error) {
    console.error("Error fetching data:", error.message);
    res.status(500).send("An error occurred while fetching data.");
  }
});
app.get("/home/account", isLoggedIn, async (req, res) => {
  let user = await userModel.findOne({ email: req.user.email });
  res.render("profile", { user });
});
app.get('/home/recipe', (req, res) => {
  let dishData = [];
  console.log(dishData.length);
  res.render('recipesearch', { dishData: dishData });
});
app.get("/home/aboutus", (req, res) => {
  res.render('aboutus');
});
app.get('/home/leaderBoard', async (req, res) => {
  try {
    // Fetch all users and populate their posts with only 'total_likes' field
    const users = await userModel.find().populate({
      path: 'post',
      select: 'total_likes' 
    });

    const leaderBoard = users.map(user => ({
      name: user.name,
      pic:user.profilePic,
      id:user._id,
      total_likes: user.post.reduce((total, post) => total + post.total_likes.length, 0) // Summing all likes
    }));
    console.log(leaderBoard);

    // Sort the leaderBoard based on total_likes in descending order
    leaderBoard.sort((a, b) => b.total_likes - a.total_likes);

    console.log(JSON.stringify(leaderBoard, null, 2));

    res.render('leaderBoard', { leaderBoard }); 
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching leaderboard data");
  }
});


/************************************************************************* */