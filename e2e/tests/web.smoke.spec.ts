import { test } from '@playwright/test';
import { webSuite } from '../src/webFramework';

test.describe('Generic web journeys', () => {
  test('config-driven smoke journey', async ({ page }, testInfo) => {
    const suite = webSuite(testInfo);
    test.skip(!suite.hasScenario('smoke-home'), 'Add "smoke-home" scenario to web.config.json to run.');
    await suite.runScenario(page, 'smoke-home');
  });

  test('imperative example', async ({ page }, testInfo) => {
    const suite = webSuite(testInfo);
    const web = suite.create(page);

    await web.goto('/');
    await web.expectVisible('body');
  });
});
