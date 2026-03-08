const mongoose = require("mongoose");

const conversationSchema = mongoose.Schema(
  {
    from: { type: String, required: [true, "from is required"] },
    to: { type: String, required: [true, "to is required"] },
    body: { type: String, default: "" },
    media_url: { type: String, default: "" },
    // TODO (Go phase): add channel_id + message_type ("dm" | "channel") fields
  },
  { timestamps: true }
);

const conversation = mongoose.model("conversation", conversationSchema);

module.exports = { conversation };
