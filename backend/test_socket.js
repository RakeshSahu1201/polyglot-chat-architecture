const io = require("socket.io-client");
const socket = io("http://localhost:5000");

socket.on("connect", () => {
  console.log("Connected to local Socket.IO server as", socket.id);
  socket.emit("login_me", { logged_user: { _id: "b456", name: "BobTester" } });
});

socket.on("get_connected_users", (data) => {
  console.log("Got users list from server:", JSON.stringify(data));
  process.exit(0);
});

socket.on("connect_error", (err) => {
  console.error("Connect error:", err.message);
  process.exit(1);
});

setTimeout(() => {
  console.log("Timeout waiting for get_connected_users event");
  process.exit(1);
}, 3000);
