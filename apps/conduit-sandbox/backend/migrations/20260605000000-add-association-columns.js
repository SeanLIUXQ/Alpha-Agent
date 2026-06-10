"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("Articles", "userId", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "Users",
        key: "id",
      },
      onDelete: "CASCADE",
    });

    await queryInterface.addColumn("Comments", "articleId", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "Articles",
        key: "id",
      },
      onDelete: "CASCADE",
    });

    await queryInterface.addColumn("Comments", "userId", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "Users",
        key: "id",
      },
      onDelete: "CASCADE",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("Comments", "userId");
    await queryInterface.removeColumn("Comments", "articleId");
    await queryInterface.removeColumn("Articles", "userId");
  },
};
