require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { verifyToken } = require("./middleware/auth");
const tuitionRoutes = require("./routes/tuitions");
const statsRoutes = require("./routes/stats");
const applicationRoutes = require("./routes/applications");
const uploadRoutes = require("./routes/upload");

const app = express();
const port = process.env.PORT || 5000;

// Allow only our frontend(s). CLIENT_URL can hold several URLs separated by commas.
const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:3000")
  .split(",")
  .map((url) => url.trim().replace(/\/+$/, "")); // remove any trailing slash

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);
app.use(express.json({ limit: "4mb" }));

app.get("/", (req, res) => {
  res.send("MentorLagbe server is running");
});

// Health check route
app.get("/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// Public routes
app.use("/api/tuitions", tuitionRoutes);
app.use("/api/stats", statsRoutes);

// Protected routes (JWT is checked inside each route file)
app.use("/api/applications", applicationRoutes);
app.use("/api/upload", uploadRoutes);

// Returns the logged-in user from the JWT (used to test authentication)
app.get("/api/me", verifyToken, (req, res) => {
  res.json({ user: req.user });
});

// 404 handler for unknown routes
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Run a normal server locally. On Vercel the app is exported and
// Vercel calls it for every request, so we must not call listen() there.
if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`MentorLagbe server listening on port ${port}`);
  });
}

module.exports = app;
