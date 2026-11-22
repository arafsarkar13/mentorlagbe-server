const express = require("express");
const { getDb } = require("../db");

const router = express.Router();

const publicFilter = { approvalStatus: "approved", isActive: true };

// GET /api/home/highlights -> live data for the hero cards on the home page
router.get("/highlights", async (req, res) => {
  try {
    const db = await getDb();
    const tuitions = db.collection("tuitions");

    // 1. The newest public tuition
    const [newestTuition] = await tuitions
      .find(publicFilter, { projection: { title: 1, subject: 1, classLevel: 1, mode: 1, monthlyFee: 1 } })
      .sort({ createdAt: -1 })
      .limit(1)
      .toArray();

    // 2. Pro tutors (verified), with how many tuitions each has
    const proTutorDocs = await db
      .collection("users")
      .find({ role: "tutor", plan: "pro" }, { projection: { name: 1, image: 1, bio: 1, email: 1 } })
      .limit(6)
      .toArray();

    const emails = proTutorDocs.map((t) => t.email);
    const theirTuitions = emails.length
      ? await tuitions
          .find({ ...publicFilter, tutorEmail: { $in: emails } }, { projection: { tutorEmail: 1, subject: 1 } })
          .toArray()
      : [];

    const proTutors = proTutorDocs
      .map((tutor) => {
        const mine = theirTuitions.filter((t) => t.tutorEmail === tutor.email);
        return {
          name: tutor.name,
          image: tutor.image || null,
          bio: tutor.bio || "",
          tuitionsCount: mine.length,
          subjects: [...new Set(mine.map((t) => t.subject))].slice(0, 3),
        };
      })
      .sort((a, b) => b.tuitionsCount - a.tuitionsCount); // busiest tutor first

    // 3. Platform numbers
    const [activeTuitions, acceptedApplications, totalTutors, topSubjects] = await Promise.all([
      tuitions.countDocuments(publicFilter),
      db.collection("applications").countDocuments({ status: "accepted" }),
      db.collection("users").countDocuments({ role: "tutor" }),
      tuitions
        .aggregate([
          { $match: publicFilter },
          { $group: { _id: "$subject", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 1 },
        ])
        .toArray(),
    ]);

    res.json({
      newestTuition: newestTuition || null,
      proTutors,
      stats: { activeTuitions, acceptedApplications, totalTutors },
      topSubject: topSubjects[0]?._id || null,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to load highlights" });
  }
});

module.exports = router;
