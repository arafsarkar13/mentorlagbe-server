const express = require("express");
const { ObjectId } = require("mongodb");
const { getDb } = require("../db");
const { verifyToken, verifyAdmin } = require("../middleware/auth");

const router = express.Router();

// Every route in this file is for admins only
router.use(verifyToken, verifyAdmin);

// GET /api/admin/stats
router.get("/stats", async (req, res) => {
  try {
    const db = await getDb();
    const [totalUsers, totalTutors, pendingTuitions, approvedTuitions, revenue] = await Promise.all([
      db.collection("users").countDocuments({}),
      db.collection("users").countDocuments({ role: "tutor" }),
      db.collection("tuitions").countDocuments({ approvalStatus: "pending" }),
      db.collection("tuitions").countDocuments({ approvalStatus: "approved" }),
      db.collection("payments").aggregate([{ $group: { _id: null, total: { $sum: "$amount" } } }]).toArray(),
    ]);
    res.json({
      totalUsers,
      totalTutors,
      pendingTuitions,
      approvedTuitions,
      totalRevenue: revenue[0]?.total || 0,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to load stats" });
  }
});

// GET /api/admin/users
router.get("/users", async (req, res) => {
  try {
    const db = await getDb();
    const users = await db
      .collection("users")
      .find({}, { projection: { name: 1, email: 1, role: 1, plan: 1, image: 1, createdAt: 1 } })
      .sort({ createdAt: -1 })
      .toArray();
    res.json({ users });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to load users" });
  }
});

// PATCH /api/admin/users/:id/role
router.patch("/users/:id/role", async (req, res) => {
  try {
    const { role } = req.body;
    if (!["student", "tutor", "admin"].includes(role)) {
      return res.status(400).json({ message: "Role must be student, tutor or admin" });
    }

    const db = await getDb();
    const users = db.collection("users");
    // BetterAuth may store ids as ObjectId or text, so we accept both
    const filter = ObjectId.isValid(req.params.id)
      ? { $or: [{ _id: new ObjectId(req.params.id) }, { _id: req.params.id }] }
      : { _id: req.params.id };

    const target = await users.findOne(filter);
    if (!target) return res.status(404).json({ message: "User not found" });

    // Stop admins from locking themselves out
    if (target.email === req.dbUser.email) {
      return res.status(400).json({ message: "You cannot change your own role" });
    }

    await users.updateOne(filter, { $set: { role } });
    res.json({ message: `${target.name} is now a ${role}` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to update role" });
  }
});

// GET /api/admin/tuitions -> all tuition posts
router.get("/tuitions", async (req, res) => {
  try {
    const db = await getDb();
    const tuitions = await db.collection("tuitions").find({}).sort({ createdAt: -1 }).toArray();
    res.json({ tuitions });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to load tuitions" });
  }
});

// PATCH /api/admin/tuitions/:id/status -> approve or reject
router.patch("/tuitions/:id/status", async (req, res) => {
  try {
    const { approvalStatus } = req.body;
    if (approvalStatus !== "approved" && approvalStatus !== "rejected") {
      return res.status(400).json({ message: "Status must be approved or rejected" });
    }
    if (!ObjectId.isValid(req.params.id)) return res.status(404).json({ message: "Tuition not found" });

    const db = await getDb();
    const result = await db
      .collection("tuitions")
      .updateOne({ _id: new ObjectId(req.params.id) }, { $set: { approvalStatus } });
    if (result.matchedCount === 0) return res.status(404).json({ message: "Tuition not found" });

    res.json({ message: `Tuition ${approvalStatus}` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to update tuition" });
  }
});

// GET /api/admin/transactions -> all payment records
router.get("/transactions", async (req, res) => {
  try {
    const db = await getDb();
    const transactions = await db.collection("payments").find({}).sort({ paidAt: -1 }).toArray();
    res.json({ transactions });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to load transactions" });
  }
});

module.exports = router;
