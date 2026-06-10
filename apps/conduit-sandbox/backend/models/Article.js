"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Article extends Model {
    static associate({ Comment, Tag, User }) {
      this.belongsTo(User, { as: "author", foreignKey: "userId" });
      this.hasMany(Comment, { foreignKey: "articleId", onDelete: "CASCADE" });
      this.belongsToMany(Tag, {
        through: "TagList",
        as: "tagList",
        foreignKey: "articleId",
        timestamps: false,
      });
      this.belongsToMany(User, {
        through: "Favorites",
        as: "favoritedBy",
        foreignKey: "articleId",
        timestamps: false,
      });
    }

    toJSON() {
      return {
        ...this.get(),
        id: undefined,
        userId: undefined,
        TagList: undefined,
        favoritedBy: undefined,
      };
    }
  }

  Article.init(
    {
      slug: DataTypes.STRING,
      title: DataTypes.STRING,
      description: DataTypes.TEXT,
      coverImage: DataTypes.STRING,
      body: DataTypes.TEXT,
      status: {
        type: DataTypes.STRING,
        defaultValue: "published",
      },
    },
    {
      sequelize,
      modelName: "Article",
    },
  );

  return Article;
};
