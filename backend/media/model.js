const mongoose = require("mongoose");

const mediaAssetSchema = new mongoose.Schema(
  {
    cid: { type: String, required: true, index: true },
    kind: {
      type: String,
      enum: ["avatar", "message", "channel-message", "attachment"],
      default: "attachment",
      index: true,
    },
    uploaded_by: { type: String, required: true, index: true },
    original_name: { type: String, required: true },
    mime_type: { type: String, required: true },
    size_bytes: { type: Number, required: true },
    gateway_url: { type: String, required: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

mediaAssetSchema.index({ uploaded_by: 1, createdAt: -1 });

const mediaAsset =
  mongoose.models.media_asset ||
  mongoose.model("media_asset", mediaAssetSchema);

module.exports = { mediaAsset };
