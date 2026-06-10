"use strict";
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("Articles", "status", {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: "published",
    });
    await queryInterface.sequelize.query("UPDATE \"Articles\" SET \"status\" = 'published' WHERE \"status\" IS NULL");
  },
  async down(queryInterface) {
    await queryInterface.removeColumn("Articles", "status");
  },
};
