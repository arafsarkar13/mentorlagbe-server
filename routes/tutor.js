const express = require("express");
const { ObjectId } = require("mongodb");
const { getDb } = require("../db");
const { verifyToken, verifyTutor } = require("../middleware/auth");

const router = express.Router();

// Every route in this file is for logged-in tutors only
router.use(verifyToken, verifyTutor);

const FREE_PLAN_LIMIT = 2;

// Checks the tuition form data. Returns an error message, or null if everything is fine.
function validateTuition(body) {
  const fee = Number(body.monthlyFee);
  const days = Number(body.daysPerWeek);

  if (!body.title || body.title.trim().length < 5) return "Title must be at least 5 characters";
  if (!body.subject || !body.subject.trim()) return "Subject is required";
  if (!body.classLevel || !body.classLevel.trim()) return "Class level is required";
  if (body.mode !== "Online" && body.mode !== "Offline") return "Mode must be Online or Offline";
  if (!body.location || !body.location.trim()) return "Location is required";
  if (!fee || fee <= 0) return "Monthly fee must be greater than 0";
  if (!Number.isInteger(days) || days < 1 || days > 7) return "Days per week must be between 1 and 7";
  if (!body.description || body.description.trim().length < 20) return "Description must be at least 20 characters";
  return null;
}

// Picks only the fields we allow, so nobody can sneak in extra data
function pickTuitionFields(body) {
  return {
    title: body.title.trim(),
    subject: body.subject.trim(),
    classLevel: body.classLevel.trim(),
    mode: body.mode,
    location: body.location.trim(),
    monthlyFee: Number(body.monthlyFee),
    daysPerWeek: Number(body.daysPerWeek),
    bannerImage: body.bannerImage || "/banners/mathematics.svg",
    description: body.description.trim(),
  };
}

// GET /api/tutor/stats
router.get("/stats", async (req, res) => {
  try {
    const db = await getDb();
    const email = req.dbUser.email;
    const [totalPosted, approvedActive, totalApplicants] = await Promise.all([
      db.collection("tuitions").countDocuments({ tutorEmail: email }),
      db.collection("tuitions").countDocuments({ tutorEmail: email, approvalStatus: "approved", isActive: true }),
      db.collection("applications").countDocuments({ tutorEmail: email }),
    ]);
    res.json({
      totalPosted,
      approvedActive,
      totalApplicants,
      plan: req.dbUser.plan || "free",
      freeLimit: FREE_PLAN_LIMIT,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to load stats" });
  }
});

// POST /api/tutor/tuitions -> post a new tuition (pending approval)
router.post("/tuitions", async (req, res) => {
  try {
    const error = validateTuition(req.body);
    if (error) return res.status(400).json({ message: error });

    const db = await getDb();
    const tuitions = db.collection("tuitions");

    // Free plan tutors can post up to 2 tuitions. Pro tutors are unlimited.
    if (req.dbUser.plan !== "pro") {
      const count = await tuitions.countDocuments({ tutorEmail: req.dbUser.email });
      if (count >= FREE_PLAN_LIMIT) {
        return res.status(403).json({
          message: `Free plan limit reached (${FREE_PLAN_LIMIT} tuitions). Upgrade to Pro for unlimited posts.`,
        });
      }
    }

    const tuition = {
      ...pickTuitionFields(req.body),
      tutorName: req.dbUser.name,
      tutorEmail: req.dbUser.email,
      approvalStatus: "pending",
      isActive: true,
      createdAt: new Date(),
    };
    const result = await tuitions.insertOne(tuition);
    res.status(201).json({ message: "Tuition submitted for approval", id: result.insertedId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to post tuition" });
  }
});

// GET /api/tutor/tuitions -> my tuitions
router.get("/tuitions", async (req, res) => {
  try {
    const db = await getDb();
    const tuitions = await db
      .collection("tuitions")
      .find({ tutorEmail: req.dbUser.email })
      .sort({ createdAt: -1 })
      .toArray();
    res.json({ tuitions });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to load tuitions" });
  }
});

// GET /api/tutor/tuitions/:id -> one of my tuitions (for the edit form)
router.get("/tuitions/:id", async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) return res.status(404).json({ message: "Tuition not found" });
    const db = await getDb();
    const tuition = await db
      .collection("tuitions")
      .findOne({ _id: new ObjectId(req.params.id), tutorEmail: req.dbUser.email });
    if (!tuition) return res.status(404).json({ message: "Tuition not found" });
    res.json({ tuition });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to load tuition" });
  }
});

// PUT /api/tutor/tuitions/:id -> edit my tuition
router.put("/tuitions/:id", async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) return res.status(404).json({ message: "Tuition not found" });
    const error = validateTuition(req.body);
    if (error) return res.status(400).json({ message: error });

    const db = await getDb();
    const tuitions = db.collection("tuitions");
    const filter = { _id: new ObjectId(req.params.id), tutorEmail: req.dbUser.email };

    const existing = await tuitions.findOne(filter);
    if (!existing) return res.status(404).json({ message: "Tuition not found" });

    const changes = pickTuitionFields(req.body);
    // A rejected tuition goes back to "pending" when the tutor fixes and saves it
    if (existing.approvalStatus === "rejected") changes.approvalStatus = "pending";

    await tuitions.updateOne(filter, { $set: changes });
    res.json({ message: "Tuition updated successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to update tuition" });
  }
});

// PATCH /api/tutor/tuitions/:id/toggle -> Active <-> Closed
router.patch("/tuitions/:id/toggle", async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) return res.status(404).json({ message: "Tuition not found" });
    const db = await getDb();
    const tuitions = db.collection("tuitions");
    const filter = { _id: new ObjectId(req.params.id), tutorEmail: req.dbUser.email };

    const existing = await tuitions.findOne(filter);
    if (!existing) return res.status(404).json({ message: "Tuition not found" });

    const nowActive = !existing.isActive;
    await tuitions.updateOne(filter, { $set: { isActive: nowActive } });
    res.json({ message: nowActive ? "Tuition reopened" : "Tuition closed", isActive: nowActive });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to change status" });
  }
});

// DELETE /api/tutor/tuitions/:id -> delete my tuition (and its applications)
router.delete("/tuitions/:id", async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) return res.status(404).json({ message: "Tuition not found" });
    const db = await getDb();
    const tuitionId = new ObjectId(req.params.id);

    const result = await db
      .collection("tuitions")
      .deleteOne({ _id: tuitionId, tutorEmail: req.dbUser.email });
    if (result.deletedCount === 0) return res.status(404).json({ message: "Tuition not found" });

    await db.collection("applications").deleteMany({ tuitionId });
    res.json({ message: "Tuition deleted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to delete tuition" });
  }
});

// GET /api/tutor/applicants -> students who applied to my tuitions
router.get("/applicants", async (req, res) => {
  try {
    const db = await getDb();
    const applicants = await db
      .collection("applications")
      .find({ tutorEmail: req.dbUser.email })
      .sort({ priority: -1, appliedAt: -1 }) // Pro students first
      .toArray();
    res.json({ applicants });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to load applicants" });
  }
});

// PATCH /api/tutor/applicants/:id -> accept or reject an application
router.patch("/applicants/:id", async (req, res) => {
  try {
    const { status } = req.body;
    if (status !== "accepted" && status !== "rejected") {
      return res.status(400).json({ message: "Status must be accepted or rejected" });
    }
    if (!ObjectId.isValid(req.params.id)) return res.status(404).json({ message: "Application not found" });

    const db = await getDb();
    const result = await db
      .collection("applications")
      .updateOne(
        { _id: new ObjectId(req.params.id), tutorEmail: req.dbUser.email },
        { $set: { status } }
      );
    if (result.matchedCount === 0) return res.status(404).json({ message: "Application not found" });

    res.json({ message: `Application ${status}` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to update application" });
  }
});

module.exports = router;
