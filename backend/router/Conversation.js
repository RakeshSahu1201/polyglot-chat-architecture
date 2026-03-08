const express = require("express");
const multer = require("multer");
const {
  create_conversation,
  get_conversation,
} = require("../repository/Conversation");
const auth = require("../middleware/auth");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "media/");
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}_${file.originalname}`);
  },
});

const upload = multer({ storage: storage }).single("media");

const conversation_router = express.Router();

// All conversation routes require a valid JWT
conversation_router.use(auth);

// POST /conversation  — create one (legacy HTTP path, prefer the socket)
conversation_router.post("/", async (req, res) => {
  try {
    const { message } = req.body;
    const { data, error } = await create_conversation({ message });
    if (error) {
      return res.status(400).json({ error });
    }
    return res.status(201).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /conversation?from=<id>&to=<id>  — fetch DM history
conversation_router.get("/", async (req, res) => {
  try {
    const { from, to } = req.query; // ← fixed: use query params, not req.body for GET
    if (!from || !to) {
      return res.status(400).json({ error: "from and to query params required" });
    }
    const { data, error } = await get_conversation({ from, to });
    if (error) {
      return res.status(400).json({ error });
    }
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /conversation/from-to  — kept for backwards compatibility with frontend
conversation_router.post("/from-to", async (req, res) => {
  try {
    const { from, to } = req.body;
    if (!from || !to) {
      return res.status(400).json({ error: "from and to are required" });
    }
    const { data, error } = await get_conversation({ from, to });
    if (error) {
      return res.status(400).json({ error });
    }
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /conversation/media
conversation_router.post("/media", (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    try {
      const { from, to } = req.body;
      if (!req.file) {
        return res.status(400).json({ error: "no file uploaded" });
      }
      const filePath = req.file.path.replace(/\\/g, "/");
      const baseUrl = process.env.SERVER_BASE_URL || "http://localhost:5000"; // ← env-driven
      const media_url = `${baseUrl}/${filePath}`;
      const message = { from, to, media_url };
      const { data, error } = await create_conversation({ message });
      if (error) {
        return res.status(400).json({ error });
      }
      return res.status(201).json(data);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });
});

module.exports = conversation_router;
