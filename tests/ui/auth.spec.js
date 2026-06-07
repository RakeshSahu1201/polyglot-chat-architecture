const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'http://localhost';

test.describe('End-to-End UI Tests', () => {
  const testUser = {
    name: `ui_user_${Date.now()}`,
    password: 'Password123!',
  };

  test('Should navigate to the home page and render the login form', async ({ page }) => {
    await page.goto(BASE_URL);
    // Index.html title is "Chat App"
    await expect(page).toHaveTitle(/Chat App/i);
    await expect(page.getByPlaceholder('Name')).toBeVisible();
    await expect(page.locator('button:has-text("Login")')).toBeVisible();
  });

  test('Should successfully register a new user', async ({ page }) => {
    await page.goto(BASE_URL);
    
    await page.getByPlaceholder('Name').fill(testUser.name);
    await page.getByPlaceholder('Password').fill(testUser.password);
    
    // Click Register button
    await page.locator('button:has-text("Register")').click();

    // The frontend code natively redirects to /chat upon success
    await expect(page).toHaveURL(/.*chat/);
    await expect(page.locator('.chat-container')).toBeVisible();
  });

  test('Should successfully login and view the chat dashboard', async ({ page }) => {
    await page.goto(BASE_URL);

    await page.getByPlaceholder('Name').fill(testUser.name);
    await page.getByPlaceholder('Password').fill(testUser.password);
    
    // Click Login button
    await page.locator('button:has-text("Login")').click();

    // Should navigate to the chat dashboard
    await expect(page).toHaveURL(/.*chat/);
    await expect(page.locator('.chat-container')).toBeVisible();
  });
});
