import { test } from '@playwright/test';
import { authSuite } from '../src/authFramework';

const suite = authSuite();

test.describe('Auth flows (template)', () => {
  test('happy path login', async ({ page }) => {
    await suite.happyPath(page);
  });

  test('invalid credentials are rejected', async ({ page }) => {
    await suite.invalidLogin(page);
  });

  test('logout clears the session', async ({ page }) => {
    await suite.happyPath(page);
    await suite.logout(page);
  });
});
