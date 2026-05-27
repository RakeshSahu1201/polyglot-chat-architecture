const express = require("express");
const multer = require("multer");
const auth = require("../middleware/auth");
const { uploadMediaHandler } = require("./controller");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Number(process.env.MEDIA_MAX_FILE_SIZE_BYTES || 10485760),
  },
});

router.post("/upload", auth, upload.single("media"), uploadMediaHandler);

module.exports = router;
