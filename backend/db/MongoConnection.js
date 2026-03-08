const mongoose = require("mongoose");

const config = async () => {
  try {
    const conn = await mongoose.connect(
      process.env.MONGO_URI || "mongodb://127.0.0.1:27017/chat-app"
    );
    console.log(
      "database connected successfully : ",
      conn.connection.readyState
    );
  } catch (error) {
    console.log("error while connecting with db", error.message);
  }
};

module.exports = { config };
