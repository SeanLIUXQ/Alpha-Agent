/** @type {import('sequelize').Options} */
const developmentUrl =
  process.env.CONDUIT_DATABASE_URL ||
  process.env.DEV_DATABASE_URL ||
  (process.env.DATABASE_URL?.startsWith("postgres")
    ? process.env.DATABASE_URL
    : undefined);

function parseLogging(value) {
  if (value === undefined || value === "" || value === "false") return false;
  if (value === "true") return console.log;
  return value;
}

module.exports = {
  development: {
    url: developmentUrl,
    username: process.env.DEV_DB_USERNAME,
    password: process.env.DEV_DB_PASSWORD,
    database: process.env.DEV_DB_NAME,
    host: process.env.DEV_DB_HOSTNAME,
    dialect: process.env.DEV_DB_DIALECT || (developmentUrl ? "postgres" : undefined),
    logging: parseLogging(process.env.DEV_DB_LOGGING),
  },
  test: {
    username: process.env.TEST_DB_USERNAME,
    password: process.env.TEST_DB_PASSWORD,
    database: process.env.TEST_DB_NAME,
    host: process.env.TEST_DB_HOSTNAME,
    dialect: process.env.TEST_DB_DIALECT,
    logging: parseLogging(process.env.TEST_DB_LOGGING),
  },
  production: {
    username: process.env.PROD_DB_USERNAME,
    password: process.env.PROD_DB_PASSWORD,
    database: process.env.PROD_DB_NAME,
    host: process.env.PROD_DB_HOSTNAME,
    dialect: process.env.PROD_DB_DIALECT,
    logging: parseLogging(process.env.PROD_DB_LOGGING),
  },
};
