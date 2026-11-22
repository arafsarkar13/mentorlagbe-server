const express = require("express");
const { ObjectId } = require("mongodb");
const { getDb } = require("../db");
const { verifyToken, verifyStudent } = require("../middleware/auth");
const { addTutorPlans } = require("../utils/tutorPlans");

const router = express.Router();

// Saved tuitions are kept inside the student's user record (field: savedTuitions),
// so we do not need a 5th collection.
router.use(verifyToken, verifyStudent);

const publicFilter = { approvalStatus: "approved", isActive: true };

// GET /api/saved/ids -> just the ids (used to colour the bookmark buttons)
router.get("/ids", (req, res) => {
  const ids = (req.dbUser.savedTuitions || []).map((id) => String(id));
  res.json({ ids });
});

// GET /api/saved -> the saved tuitions (still public ones only)
router.get("/", async (req, res) => {
  try {
    const db = await getDb();
    const ids = req.dbUser.savedTuitions || [];
    if (ids.length === 0) return res.json({ tuitions: [] });

    const tuitions = await db
      .collection("tuitions")
      .find({ _id: { $in: ids }, ...publicFilter }, { projection: { reviews: 0 } })
      .sort({ createdAt: -1 })
      .toArray();

    res.json({ tuitions: await addTutorPlans(db, tuitions) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to load saved tuitions" });
  }
});

// POST /api/saved/:id -> save a tuition
router.post("/:id", async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) return res.status(404).json({ message: "Tuition not found" });

    const db = await getDb();
    const tuitionId = new ObjectId(req.params.id);
    const tuition = await db.collection("tuitions").findOne({ _id: tuitionId, ...publicFilter });
    if (!tuition) return res.status(404).json({ message: "Tuition not found" });

    // $addToSet never adds the same id twice
    await db.collection("users").updateOne({ email: req.dbUser.email }, { $addToSet: { savedTuitions: tuitionId } });
    res.status(201).json({ message: "Saved to your list" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not save this tuition" });
  }
});

// DELETE /api/saved/:id -> remove from the saved list
router.delete("/:id", async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) return res.status(404).json({ message: "Tuition not found" });

    const db = await getDb();
    await db
      .collection("users")
      .updateOne({ email: req.dbUser.email }, { $pull: { savedTuitions: new ObjectId(req.params.id) } });
    res.json({ message: "Removed from your list" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not remove this tuition" });
  }
});

module.exports = router;
