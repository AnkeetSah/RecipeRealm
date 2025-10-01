
const getRecipe = (req, res) => {
  let dishData = [];
  res.render('recipesearch', { dishData });
};

module.exports = {
  getRecipe
};