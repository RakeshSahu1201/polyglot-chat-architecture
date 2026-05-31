const mongoose = require("mongoose");

const conversationSchema = mongoose.Schema(
  {
    from: { type: String, required: [true, "from is required"] },
    to: { type: String, required: [true, "to is required"] },
    body: { type: String, default: "" },
    media_url: { type: String, default: "" },
    thumbnail_url: { type: String, default: "" },
    message_type: {
      type: String,
      enum: ["dm", "channel"],
      default: "dm",
      index: true,
    },
    channel_id: { type: String, default: null, index: true }, // UUID for channel messages, null for DMs
  },
  { timestamps: true }
);

// Create text index for search functionality
conversationSchema.index({ body: "text", from: 1, to: 1 });

// Indexes for efficient queries
conversationSchema.index({ from: 1, to: 1, createdAt: -1 });
conversationSchema.index({ message_type: 1, channel_id: 1, createdAt: -1 });

const conversation = mongoose.model("conversation", conversationSchema);

module.exports = { conversation };
