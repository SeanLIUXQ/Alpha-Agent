const path = require("path");

for (const envPath of [
  path.resolve(__dirname, ".env"),
  path.resolve(__dirname, "..", ".env"),
  path.resolve(__dirname, "..", "..", "..", ".env"),
]) {
  require("dotenv").config({ path: envPath, override: false, quiet: true });
}

const env = process.env.NODE_ENV || "development";
const PORT = process.env.PORT || 3001;
const express = require("express");
const cors = require("cors");
const errorHandler = require("./middleware/errorHandler");
const { registerPreviewRoutes } = require("./previewData");

const app = express();
app.use(cors());
app.use(express.json());

const previewMode =
  process.env.CONDUIT_PREVIEW_MODE === "true" ||
  (!process.env.CONDUIT_DATABASE_URL &&
    !process.env.DEV_DATABASE_URL &&
    !process.env.DATABASE_URL?.startsWith("postgres"));

if (!previewMode) {
  const { sequelize } = require("./models");

  (async () => {
    try {
      await sequelize.sync({ alter: true });
      console.log(`Connection with ${env} database has been established.`);
    } catch (error) {
      console.error("Unable to connect to the database:", error);
    }
  })();
} else {
  console.log("Conduit preview mode enabled; database-backed routes are bypassed.");
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "conduit-backend", previewMode });
});

if (process.env.NODE_ENV === "production") {
  app.use(express.static("../frontend/dist"));
} else {
  app.get("/", (_req, res) => res.json({ status: "API is running on /api" }));
}

if (previewMode) {
  registerPreviewRoutes(app);
} else {
  const usersRoutes = require("./routes/users");
  const userRoutes = require("./routes/user");
  const articlesRoutes = require("./routes/articles");
  const profilesRoutes = require("./routes/profiles");
  const tagsRoutes = require("./routes/tags");

  app.use("/api/users", usersRoutes);
  app.use("/api/user", userRoutes);
  app.use("/api/articles", articlesRoutes);
  app.use("/api/profiles", profilesRoutes);
  app.use("/api/tags", tagsRoutes);
}

app.get("/*any", (_req, res) =>
  res.status(404).json({ errors: { body: ["Not found"] } }),
);
app.use(errorHandler);

app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`),
);
