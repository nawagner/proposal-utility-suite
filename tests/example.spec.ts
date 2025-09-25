import { test, expect } from '@playwright/test';

test('homepage has title', async ({ page }) => {
  await page.goto('/');

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Proposal Utility Suite/);
});

test('synthetic proposal generator page loads', async ({ page }) => {
  await page.goto('/synthetic-proposal-generator');

  // Check that the page has loaded correctly
  await expect(page.locator('h1')).toContainText('Synthetic Proposal Generator');
});