const express = require("express");
const { getDb } = require("../db");

const router = express.Router();

// GET /api/stats -> public counters for the home page
router.get("/", async (req, res) => {
  try {
    const db = await getDb();
    const [tutors, students, tuitions] = await Promise.all([
      db.collection("users").countDocuments({ role: "tutor" }),
      db.collection("users").countDocuments({ role: "student" }),
      db
        .collection("tuitions")
        .countDocuments({ approvalStatus: "approved", isActive: true }),
    ]);
    res.json({ tutors, students, tuitions });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to load stats" });
  }
});

module.exports = router;
