const request = require("supertest");

// For CI, we assume the NGINX API Gateway is running on localhost:80
const API_URL = process.env.API_URL || "http://localhost";

describe("API Integration Tests", () => {
  let userToken = "";
  const testUser = {
    name: `ci_user_${Date.now()}`,
    email: `citest${Date.now()}@test.com`,
    password: "Password123!",
  };

  test("Health check should return 200", async () => {
    const res = await request(API_URL).get("/health");
    expect(res.status).toBe(200);
  });

  test("Should successfully register a new user", async () => {
    const res = await request(API_URL)
      .post("/api/auth/register")
      .send(testUser);
    
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("token");
  });

  test("Should successfully login the test user", async () => {
    const res = await request(API_URL)
      .post("/api/auth/login")
      .send({
        name: testUser.name,
        password: testUser.password,
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("token");
    userToken = res.body.token;
  });

  test("Should fetch channels using the JWT token", async () => {
    const res = await request(API_URL)
      .get("/api/channels")
      .set("Authorization", `Bearer ${userToken}`);
      
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("channels");
    expect(Array.isArray(res.body.channels)).toBe(true);
  });
});
