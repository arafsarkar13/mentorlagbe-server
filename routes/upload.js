const express = require("express");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();

// POST /api/upload  (logged-in users) -> sends an image to ImgBB and returns its URL
// The ImgBB key stays on the server, so it is never exposed in the browser.
router.post("/", verifyToken, async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ message: "No image received" });
    }
    if (!process.env.IMGBB_API_KEY) {
      return res.status(500).json({ message: "Image upload is not configured" });
    }

    // "data:image/png;base64,AAAA..." -> "AAAA..."
    const base64 = image.split(",").pop();

    const response = await fetch(
      `https://api.imgbb.com/1/upload?key=${process.env.IMGBB_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ image: base64 }),
      }
    );
    const data = await response.json();

    if (!response.ok || !data.success) {
      return res.status(400).json({ message: "Image upload failed" });
    }

    res.json({ url: data.data.url });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Image upload failed" });
  }
});

module.exports = router;
