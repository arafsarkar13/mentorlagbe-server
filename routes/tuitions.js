const express = require("express");
const { ObjectId } = require("mongodb");
const { getDb } = require("../db");
const { addTutorPlans } = require("../utils/tutorPlans");

const router = express.Router();

// Only approved + active tuitions are public
const publicFilter = { approvalStatus: "approved", isActive: true };

// Escape special characters so a search like "c++" cannot break the regex
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// GET /api/tuitions?search=&subject=&classLevel=&mode=&page=1&limit=9
router.get("/", async (req, res) => {
  try {
    const db = await getDb();
    const { search, subject, classLevel, mode } = req.query;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 9, 1), 24);

    const query = { ...publicFilter };

    if (search && search.trim()) {
      const regex = new RegExp(escapeRegex(search.trim()), "i");
      query.$or = [{ title: regex }, { subject: regex }];
    }
    if (subject) query.subject = subject;
    if (classLevel) query.classLevel = classLevel;
    if (mode === "Online" || mode === "Offline") query.mode = mode;

    const collection = db.collection("tuitions");
    const total = await collection.countDocuments(query);
    const found = await collection
      .find(query, { projection: { reviews: 0 } })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();
    const tuitions = await addTutorPlans(db, found);

    res.json({
      tuitions,
      total,
      page,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to load tuitions" });
  }
});

// GET /api/tuitions/latest  -> the 6 newest public tuitions (home page)
router.get("/latest", async (req, res) => {
  try {
    const db = await getDb();
    const found = await db
      .collection("tuitions")
      .find(publicFilter, { projection: { reviews: 0 } })
      .sort({ createdAt: -1 })
      .limit(6)
      .toArray();
    res.json({ tuitions: await addTutorPlans(db, found) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to load latest tuitions" });
  }
});

// GET /api/tuitions/filters -> values for the filter dropdowns
router.get("/filters", async (req, res) => {
  try {
    const db = await getDb();
    const collection = db.collection("tuitions");
    const subjects = await collection.distinct("subject", publicFilter);
    const classLevels = await collection.distinct("classLevel", publicFilter);
    res.json({ subjects: subjects.sort(), classLevels: classLevels.sort() });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to load filters" });
  }
});

// GET /api/tuitions/:id -> one tuition + a short tutor summary
router.get("/:id", async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: "Tuition not found" });
    }

    const db = await getDb();
    const tuition = await db
      .collection("tuitions")
      .findOne({ _id: new ObjectId(req.params.id), ...publicFilter });

    if (!tuition) {
      return res.status(404).json({ message: "Tuition not found" });
    }

    const tutor = await db
      .collection("users")
      .findOne(
        { email: tuition.tutorEmail },
        { projection: { name: 1, image: 1, bio: 1, plan: 1, createdAt: 1 } }
      );

    // Show reviews publicly, but never expose the student's email
    const reviews = (tuition.reviews || []).map((r) => ({
      studentName: r.studentName,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt,
    }));

    res.json({ tuition: { ...tuition, reviews }, tutor });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to load tuition" });
  }
});

module.exports = router;
