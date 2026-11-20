const express = require("express");
const { ObjectId } = require("mongodb");
const { getDb } = require("../db");
const { verifyToken, verifyStudent } = require("../middleware/auth");

const router = express.Router();

// POST /api/applications  (students only) -> apply for a tuition
router.post("/", verifyToken, verifyStudent, async (req, res) => {
  try {
    const { tuitionId, phone, preferredSchedule, studentNote } = req.body;

    if (!ObjectId.isValid(tuitionId)) {
      return res.status(400).json({ message: "Invalid tuition" });
    }
    if (!phone || phone.trim().length < 7) {
      return res.status(400).json({ message: "Please enter a valid phone number" });
    }
    if (!preferredSchedule || !preferredSchedule.trim()) {
      return res.status(400).json({ message: "Please enter your preferred schedule" });
    }

    const db = await getDb();
    const tuition = await db.collection("tuitions").findOne({
      _id: new ObjectId(tuitionId),
      approvalStatus: "approved",
      isActive: true,
    });
    if (!tuition) {
      return res.status(404).json({ message: "This tuition is not available" });
    }

    const applications = db.collection("applications");

    // Prevent duplicate applications from the same student
    const existing = await applications.findOne({
      tuitionId: tuition._id,
      studentEmail: req.dbUser.email,
    });
    if (existing) {
      return res.status(409).json({ message: "You have already applied for this tuition" });
    }

    await applications.insertOne({
      tuitionId: tuition._id,
      tuitionTitle: tuition.title,
      subject: tuition.subject,
      monthlyFee: tuition.monthlyFee,
      tutorEmail: tuition.tutorEmail,
      tutorName: tuition.tutorName,
      studentName: req.dbUser.name,
      studentEmail: req.dbUser.email,
      studentPhone: phone.trim(),
      preferredSchedule: preferredSchedule.trim(),
      studentNote: (studentNote || "").trim(),
      status: "pending",
      appliedAt: new Date(),
    });

    res.status(201).json({ message: "Application submitted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to submit application" });
  }
});

// GET /api/applications/my  (students only) -> my applications
router.get("/my", verifyToken, verifyStudent, async (req, res) => {
  try {
    const db = await getDb();
    const applications = await db
      .collection("applications")
      .find({ studentEmail: req.dbUser.email })
      .sort({ appliedAt: -1 })
      .toArray();
    res.json({ applications });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to load applications" });
  }
});

// GET /api/applications/check/:tuitionId  (students only) -> already applied?
router.get("/check/:tuitionId", verifyToken, verifyStudent, async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.tuitionId)) {
      return res.json({ applied: false });
    }
    const db = await getDb();
    const existing = await db.collection("applications").findOne({
      tuitionId: new ObjectId(req.params.tuitionId),
      studentEmail: req.dbUser.email,
    });
    res.json({ applied: Boolean(existing) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to check application" });
  }
});

// DELETE /api/applications/:id  (students only) -> cancel a pending application
router.delete("/:id", verifyToken, verifyStudent, async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid application" });
    }
    const db = await getDb();
    const result = await db.collection("applications").deleteOne({
      _id: new ObjectId(req.params.id),
      studentEmail: req.dbUser.email,
      status: "pending",
    });
    if (result.deletedCount === 0) {
      return res
        .status(400)
        .json({ message: "Only your own pending applications can be cancelled" });
    }
    res.json({ message: "Application cancelled" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to cancel application" });
  }
});

module.exports = router;
