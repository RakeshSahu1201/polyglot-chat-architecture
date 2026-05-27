const { uploadMediaAsset } = require("./service");

const uploadMediaHandler = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "media file is required" });
    }

    const userId = req.user?.id;
    const {
      kind = "attachment",
      from = "",
      to = "",
      channelId = "",
      body = "",
    } = req.body;

    const asset = await uploadMediaAsset({
      file: req.file,
      uploadedBy: userId,
      kind,
      metadata: {
        from,
        to,
        channelId,
        body,
        source_service: req.header("x-source-service") || "node",
      },
    });

    return res.status(201).json(asset);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  uploadMediaHandler,
};
