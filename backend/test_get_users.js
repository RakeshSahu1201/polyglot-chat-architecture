const redis = require("./db/RedisClient");

async function main() {
  await redis.set("online:test321", JSON.stringify({id: "test321", name: "Alice", socket_id: "123"}), "EX", 100);
  
  const keys = await redis.keys("online:*");
  console.log("Keys found:", keys);
  
  const users = [];
  for (const key of keys) {
    const raw = await redis.get(key);
    console.log("Raw value for", key, ":", raw);
    if (raw) {
      users.push(JSON.parse(raw));
    }
  }
  console.log("Parsed users:", users);
  process.exit(0);
}
main().catch(console.error);
