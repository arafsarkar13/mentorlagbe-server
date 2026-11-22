const express = require("express");
const { ObjectId } = require("mongodb");
const { getDb } = require("../db");
const { verifyToken, verifyStudent } = require("../middleware/auth");

const router = express.Router();

// Reviews are kept inside the tuition document (field: reviews), so we do not need a 5th collection.
router.use(verifyToken, verifyStudent);

// Only students whose application was ACCEPTED may review
async function hasAcceptedApplication(db, tuitionId, studentEmail) {
  const application = await db
    .collection("applications")
    .findOne({ tuitionId, studentEmail, status: "accepted" });
  return Boolean(application);
}

// GET /api/reviews/can/:tuitionId -> can this student review, and what did they write before?
router.get("/can/:tuitionId", async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.tuitionId)) return res.json({ canReview: false, myReview: null });

    const db = await getDb();
    const tuitionId = new ObjectId(req.params.tuitionId);
    const canReview = await hasAcceptedApplication(db, tuitionId, req.dbUser.email);
    if (!canReview) return res.json({ canReview: false, myReview: null });

    const tuition = await db.collection("tuitions").findOne({ _id: tuitionId });
    const myReview = (tuition?.reviews || []).find((r) => r.studentEmail === req.dbUser.email) || null;
    res.json({ canReview: true, myReview: myReview && { rating: myReview.rating, comment: myReview.comment } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to check review access" });
  }
});

// POST /api/reviews -> add (or update) my review
router.post("/", async (req, res) => {
  try {
    const { tuitionId, comment } = req.body;
    const rating = Number(req.body.rating);

    if (!ObjectId.isValid(tuitionId)) return res.status(400).json({ message: "Invalid tuition" });
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ message: "Rating must be from 1 to 5 stars" });
    }
    if (!comment || comment.trim().length < 5) {
      return res.status(400).json({ message: "Please write a short feedback (at least 5 characters)" });
    }

    const db = await getDb();
    const id = new ObjectId(tuitionId);

    if (!(await hasAcceptedApplication(db, id, req.dbUser.email))) {
      return res.status(403).json({ message: "Only students with an accepted application can review" });
    }

    const tuitions = db.collection("tuitions");
    const tuition = await tuitions.findOne({ _id: id });
    if (!tuition) return res.status(404).json({ message: "Tuition not found" });

    // Replace my old review (if any) and add the new one
    const reviews = (tuition.reviews || []).filter((r) => r.studentEmail !== req.dbUser.email);
    reviews.unshift({
      studentEmail: req.dbUser.email,
      studentName: req.dbUser.name,
      rating,
      comment: comment.trim(),
      createdAt: new Date(),
    });

    const total = reviews.reduce((sum, r) => sum + r.rating, 0);
    await tuitions.updateOne(
      { _id: id },
      { $set: { reviews, ratingCount: reviews.length, ratingAvg: Math.round((total / reviews.length) * 10) / 10 } }
    );

    res.status(201).json({ message: "Thank you for your review" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to save review" });
  }
});

module.exports = router;
