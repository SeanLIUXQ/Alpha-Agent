const slugify = (string) => {
  return string.trim().toLowerCase().replace(/\W|_/g, "-");
};

const appendTagList = (articleTags, article) => {
  const tagList = articleTags.map((tag) => tag.name);

  if (!article) return tagList;
  article.dataValues.tagList = tagList;
};

const appendFavorites = async (loggedUser, article) => {
  const hasFavorite = article.hasFavoritedBy || article.hasUser;
  const countFavorites = article.countFavoritedBy || article.countUsers;
  const favorited = await hasFavorite.call(article, loggedUser ? loggedUser : null);
  article.dataValues.favorited = loggedUser ? favorited : false;

  const favoritesCount = await countFavorites.call(article);
  article.dataValues.favoritesCount = favoritesCount;
};

const appendFollowers = async (loggedUser, toAppend) => {
  //
  if (toAppend?.author) {
    const author = await toAppend.getAuthor();

    const hasFollower = author.hasFollower || author.hasFollowers;
    const countFollowers = author.countFollowers;
    const following = hasFollower ? await hasFollower.call(author, loggedUser ? loggedUser : null) : false;
    toAppend.author.dataValues.following = loggedUser ? following : false;

    const followersCount = countFollowers ? await countFollowers.call(author) : 0;
    toAppend.author.dataValues.followersCount = followersCount;
    //
  } else {
    const hasFollower = toAppend.hasFollower || toAppend.hasFollowers;
    const countFollowers = toAppend.countFollowers;
    const following = hasFollower
      ? await hasFollower.call(toAppend, loggedUser ? loggedUser : null)
      : false;
    toAppend.dataValues.following = loggedUser ? following : false;

    const followersCount = countFollowers ? await countFollowers.call(toAppend) : 0;
    toAppend.dataValues.followersCount = followersCount;
  }
};

module.exports = { slugify, appendTagList, appendFavorites, appendFollowers };
