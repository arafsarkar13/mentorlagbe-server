const express = require("express");
const { getDb } = require("../db");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();

// PATCH /api/users/me/role -> a new Google user picks "student" or "tutor" ONE time.
// Admin can never be chosen here.
router.patch("/me/role", verifyToken, async (req, res) => {
  try {
    const { role } = req.body;
    if (role !== "student" && role !== "tutor") {
      return res.status(400).json({ message: "Choose student or tutor" });
    }

    const db = await getDb();
    const users = db.collection("users");
    const user = await users.findOne({ email: req.user.email });

    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.roleChosen !== false) {
      return res.status(400).json({ message: "Your role is already set" });
    }

    await users.updateOne({ email: user.email }, { $set: { role, roleChosen: true } });
    res.json({ message: `Welcome! Your account is set up as a ${role}` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not save your role" });
  }
});

module.exports = router;
