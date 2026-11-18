const jwt = require("jsonwebtoken");
const { getDb } = require("../db");

// 1. Check the Bearer token sent by the client
function verifyToken(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Unauthorized: token missing" });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized: invalid token" });
  }
}

// 2. Check the user's CURRENT role in the database
// (so a role changed by the admin takes effect immediately)
function requireRole(role) {
  return async (req, res, next) => {
    try {
      const db = await getDb();
      const user = await db.collection("users").findOne({ email: req.user.email });

      if (!user || user.role !== role) {
        return res.status(403).json({ message: `Forbidden: ${role} access only` });
      }

      req.dbUser = user;
      next();
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  };
}

const verifyStudent = requireRole("student");
const verifyTutor = requireRole("tutor");
const verifyAdmin = requireRole("admin");

module.exports = { verifyToken, verifyStudent, verifyTutor, verifyAdmin };
