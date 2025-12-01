import fs from 'fs';
import path from 'path';
import { expect, Page, APIResponse } from '@playwright/test';

export type SelectorMap = {
  email: string;
  password: string;
  submit: string;
  logout?: string;
  error?: string;
  userIndicator?: string;
};

export type TokenExpectations = {
  cookiePattern?: RegExp | string;
  storageKeys?: string[];
};

export type AuthConfig = {
  loginPath?: string;
  protectedPath: string;
  loginRequestPattern?: RegExp;
  selectors: SelectorMap;
  credentials: {
    valid: { email: string; password: string };
    invalid?: { email: string; password: string };
  };
  messages?: {
    invalid?: string | RegExp;
    locked?: string | RegExp;
  };
  tokens?: TokenExpectations;
};

type PartialAuthConfig = Partial<AuthConfig> & {
  loginRequestPattern?: RegExp | string;
  selectors?: Partial<SelectorMap>;
  credentials?: {
    valid?: Partial<AuthConfig['credentials']['valid']>;
    invalid?: Partial<AuthConfig['credentials']['invalid']>;
  };
  tokens?: {
    cookiePattern?: RegExp | string;
    storageKeys?: string[];
  };
};

const defaultConfig: AuthConfig = {
  loginPath: '/login',
  protectedPath: process.env.E2E_PROTECTED_PATH || '/dashboard',
  loginRequestPattern: /login|api\/(auth|login)/i,
  selectors: {
    email: '[data-cy=email] input, [data-cy=email]',
    password: '[data-cy=password] input, [data-cy=password]',
    submit: '[data-cy=submit]',
    logout: '[data-cy=logout]',
    error: 'text=/invalid|unauthorized|forbidden/i',
    userIndicator: '[data-cy=user], header, nav'
  },
  credentials: {
    valid: {
      email: process.env.E2E_USER_EMAIL || 'qa@example.com',
      password: process.env.E2E_USER_PASSWORD || 'Passw0rd!'
    },
    invalid: {
      email: 'wrong@example.com',
      password: 'bad-pass'
    }
  },
  messages: {
    invalid: /invalid|unauthorized|forbidden/i
  },
  tokens: {
    cookiePattern: /auth|token/i,
    storageKeys: ['auth', 'token', 'refresh', 'idToken']
  }
};

const loadFileConfig = (): PartialAuthConfig => {
  const filePath = path.join(process.cwd(), 'auth.config.json');
  if (!fs.existsSync(filePath)) {
    return {};
  }
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as PartialAuthConfig;
};

const merge = (base: any, override: any) => {
  if (!override) return base;
  const output: any = { ...base };
  for (const key of Object.keys(override)) {
    const value = (override as any)[key];
    if (value === undefined) continue;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      output[key] = merge(base[key] || {}, value);
    } else {
      output[key] = value;
    }
  }
  return output;
};

export const loadAuthConfig = (): AuthConfig => {
  const fileConfig = loadFileConfig();
  const merged = merge(defaultConfig, fileConfig) as AuthConfig;
  merged.loginRequestPattern = normalizeRegex(merged.loginRequestPattern) ?? defaultConfig.loginRequestPattern;
  if (merged.tokens?.cookiePattern) {
    merged.tokens.cookiePattern = normalizeRegex(merged.tokens.cookiePattern);
  }
  return merged;
};

const normalizeRegex = (value?: RegExp | string) => {
  if (!value) return undefined;
  if (value instanceof RegExp) return value;
  if (typeof value === 'string') return new RegExp(value);
  return undefined;
};

export const goToLogin = async (page: Page, config: AuthConfig) => {
  if (config.loginPath) {
    await page.goto(config.loginPath);
  }
  await expect(page).toHaveURL(/login|sign/i);
};

export const loginWith = async (
  page: Page,
  config: AuthConfig,
  email: string,
  password: string
): Promise<APIResponse | null> => {
  const { selectors, loginRequestPattern } = config;
  await page.locator(selectors.email).fill(email);
  await page.locator(selectors.password).fill(password);

  const pending = loginRequestPattern
    ? page.waitForResponse(resp => loginRequestPattern.test(resp.url()))
    : null;

  await page.locator(selectors.submit).click();
  return pending ? await pending : null;
};

export const assertLoggedIn = async (page: Page, config: AuthConfig) => {
  await expect(page).toHaveURL(new RegExp(config.protectedPath));
  if (config.selectors.userIndicator) {
    await expect(page.locator(config.selectors.userIndicator)).toBeVisible();
  }
  await assertTokensPresent(page, config.tokens);
};

export const assertLoginRejected = async (page: Page, config: AuthConfig) => {
  if (config.messages?.invalid && config.selectors.error) {
    await expect(page.locator(config.selectors.error)).toContainText(config.messages.invalid);
  }
  await assertTokensCleared(page, config.tokens);
};

export const logoutAndVerify = async (page: Page, config: AuthConfig) => {
  if (config.selectors.logout) {
    await page.locator(config.selectors.logout).click({ trial: false });
  }
  await expect(page).toHaveURL(/login|sign/i);
  await assertTokensCleared(page, config.tokens);
};

export const assertTokensPresent = async (page: Page, tokens?: TokenExpectations) => {
  if (!tokens) return;
  const cookiePattern = normalizeRegex(tokens.cookiePattern);
  if (cookiePattern) {
    const cookies = await page.context().cookies();
    expect(cookies.filter(c => cookiePattern.test(c.name))).not.toHaveLength(0);
  }
  if (tokens.storageKeys && tokens.storageKeys.length > 0) {
    const storage = await page.evaluate(keys => ({
      local: keys.filter(k => window.localStorage.getItem(k) !== null),
      session: keys.filter(k => window.sessionStorage.getItem(k) !== null)
    }), tokens.storageKeys);
    expect(storage.local.concat(storage.session)).not.toHaveLength(0);
  }
};

export const assertTokensCleared = async (page: Page, tokens?: TokenExpectations) => {
  if (!tokens) return;
  const cookiePattern = normalizeRegex(tokens.cookiePattern);
  if (cookiePattern) {
    const cookies = await page.context().cookies();
    expect(cookies.filter(c => cookiePattern.test(c.name))).toHaveLength(0);
  }
  if (tokens.storageKeys && tokens.storageKeys.length > 0) {
    const storage = await page.evaluate(keys => ({
      local: keys.filter(k => window.localStorage.getItem(k) !== null),
      session: keys.filter(k => window.sessionStorage.getItem(k) !== null)
    }), tokens.storageKeys);
    expect(storage.local).toHaveLength(0);
    expect(storage.session).toHaveLength(0);
  }
};

export const authSuite = () => {
  const config = loadAuthConfig();
  return {
    config,
    async happyPath(page: Page) {
      await goToLogin(page, config);
      await loginWith(page, config, config.credentials.valid.email, config.credentials.valid.password);
      await assertLoggedIn(page, config);
    },
    async invalidLogin(page: Page) {
      await goToLogin(page, config);
      const invalid = config.credentials.invalid ?? {
        email: `${Date.now()}@example.com`,
        password: 'bad-pass'
      };
      await loginWith(page, config, invalid.email, invalid.password);
      await assertLoginRejected(page, config);
    },
    async logout(page: Page) {
      await logoutAndVerify(page, config);
    }
  };
};
