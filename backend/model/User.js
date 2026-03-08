const mongoose = require("mongoose");

const userSchema = mongoose.Schema(
  {
    name: {
      type: String,
      unique: true,
      required: [true, "username must not be empty"],
      trim: true,
    },
    password: {
      type: String,
      required: [true, "password must not be empty"],
    },
  },
  { timestamps: true }
);

const user_model = mongoose.model("User", userSchema);

module.exports = { user_model };
