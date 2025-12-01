import fs from 'fs';
import path from 'path';
import { expect, Page, TestInfo } from '@playwright/test';

type WaitUntil = 'load' | 'domcontentloaded' | 'networkidle';

type ScenarioMetadata = {
  label?: string;
};

type GotoStep = ScenarioMetadata & {
  action: 'goto';
  target: string;
  waitUntil?: WaitUntil;
};

type ClickStep = ScenarioMetadata & {
  action: 'click';
  target: string;
};

type FillStep = ScenarioMetadata & {
  action: 'fill';
  target: string;
  value: string;
};

type FillFormStep = ScenarioMetadata & {
  action: 'fill-form';
  fields: Record<string, string>;
};

type ExpectVisibleStep = ScenarioMetadata & {
  action: 'expect-visible';
  target: string;
};

type ExpectTextStep = ScenarioMetadata & {
  action: 'expect-text';
  target: string;
  value: string | RegExp;
  asRegex?: boolean;
};

type WaitForResponseStep = ScenarioMetadata & {
  action: 'wait-for-response';
  url: RegExp | string;
  status?: number | number[];
};

type ExpectUrlStep = ScenarioMetadata & {
  action: 'expect-url-contains';
  value: string | RegExp;
};

type ExpectAttributeStep = ScenarioMetadata & {
  action: 'expect-attribute';
  target: string;
  name: string;
  value: string | RegExp;
};

type ExpectCountStep = ScenarioMetadata & {
  action: 'expect-count';
  target: string;
  count: number;
};

type UploadFileStep = ScenarioMetadata & {
  action: 'upload-file';
  target: string;
  files: string | string[];
};

type WaitForRequestsStep = ScenarioMetadata & {
  action: 'wait-for-requests';
  url: RegExp | string;
  status?: number | number[];
  atLeast?: number;
  timeout?: number;
};

type ExpectToastStep = ScenarioMetadata & {
  action: 'expect-toast';
  target: string;
  value?: string | RegExp;
};

export type ScenarioStep =
  | GotoStep
  | ClickStep
  | FillStep
  | FillFormStep
  | ExpectVisibleStep
  | ExpectTextStep
  | WaitForResponseStep
  | ExpectUrlStep
  | ExpectAttributeStep
  | ExpectCountStep
  | UploadFileStep
  | WaitForRequestsStep
  | ExpectToastStep;

export type WebConfig = {
  baseUrl: string;
  defaultTimeout: number;
  screenshotOnFailure: boolean;
  scenarios?: Record<string, ScenarioStep[]>;
};

type PartialWebConfig = Partial<WebConfig>;

const defaultWebConfig: WebConfig = {
  baseUrl: process.env.E2E_BASE_URL || 'http://localhost:3000',
  defaultTimeout: 30_000,
  screenshotOnFailure: true,
  scenarios: {}
};

const loadFileConfig = (): PartialWebConfig => {
  const filePath = path.join(process.cwd(), 'web.config.json');
  if (!fs.existsSync(filePath)) {
    return {};
  }
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as PartialWebConfig;
};

const merge = (base: any, override: any) => {
  if (!override) return base;
  const output: any = { ...base };
  for (const key of Object.keys(override)) {
    const value = override[key];
    if (value === undefined) continue;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      output[key] = merge(base[key] || {}, value);
    } else {
      output[key] = value;
    }
  }
  return output;
};

export const loadWebConfig = (): WebConfig => {
  const fileConfig = loadFileConfig();
  return merge(defaultWebConfig, fileConfig) as WebConfig;
};

const isFullUrl = (target: string) => /^https?:\/\//i.test(target);

const normalizeRegex = (value?: RegExp | string) => {
  if (!value) return undefined;
  if (value instanceof RegExp) return value;
  if (typeof value === 'string') return new RegExp(value);
  return undefined;
};

export class WebAutomation {
  private page: Page;
  private config: WebConfig;
  private testInfo?: TestInfo;

  constructor(page: Page, config: WebConfig, testInfo?: TestInfo) {
    this.page = page;
    this.config = config;
    this.testInfo = testInfo;
  }

  async goto(target: string, waitUntil: WaitUntil = 'networkidle') {
    await this.runWithArtifacts(`goto-${target}`, async () => {
      await this.page.goto(this.resolve(target), {
        waitUntil,
        timeout: this.config.defaultTimeout
      });
    });
  }

  async click(target: string) {
    await this.runWithArtifacts(`click-${target}`, async () => {
      await this.page.locator(target).click({ timeout: this.config.defaultTimeout });
    });
  }

  async fill(target: string, value: string) {
    await this.runWithArtifacts(`fill-${target}`, async () => {
      await this.page.locator(target).fill(value, { timeout: this.config.defaultTimeout });
    });
  }

  async fillForm(fields: Record<string, string>) {
    for (const [selector, value] of Object.entries(fields)) {
      await this.fill(selector, value);
    }
  }

  async expectVisible(target: string) {
    await this.runWithArtifacts(`expect-visible-${target}`, async () => {
      await expect(this.page.locator(target)).toBeVisible({ timeout: this.config.defaultTimeout });
    });
  }

  async expectText(target: string, value: string | RegExp, asRegex = false) {
    const matcher = asRegex ? normalizeRegex(value) || value : value;
    await this.runWithArtifacts(`expect-text-${target}`, async () => {
      await expect(this.page.locator(target)).toContainText(matcher, {
        timeout: this.config.defaultTimeout
      });
    });
  }

  async expectUrlContains(value: string | RegExp) {
    await this.runWithArtifacts(`expect-url-${value}`, async () => {
      await expect(this.page).toHaveURL(value, { timeout: this.config.defaultTimeout });
    });
  }

  async waitForResponse(url: RegExp | string, status: number | number[] = 200) {
    const expectedStatuses = Array.isArray(status) ? status : [status];
    const matches = (respUrl: string) =>
      url instanceof RegExp ? url.test(respUrl) : respUrl.includes(url);

    await this.runWithArtifacts(`wait-response-${url}`, async () => {
      const response = await this.page.waitForResponse(
        resp => matches(resp.url()),
        { timeout: this.config.defaultTimeout }
      );
      expect(expectedStatuses).toContain(response.status());
    });
  }

  async waitForRequests(url: RegExp | string, opts?: { status?: number | number[]; atLeast?: number; timeout?: number }) {
    const expectedStatuses = Array.isArray(opts?.status) ? opts?.status : opts?.status ? [opts.status] : undefined;
    const atLeast = opts?.atLeast ?? 1;
    const timeout = opts?.timeout ?? this.config.defaultTimeout;
    const matches = (respUrl: string) => (url instanceof RegExp ? url.test(respUrl) : respUrl.includes(url));

    await this.runWithArtifacts(`wait-requests-${url}`, async () => {
      const seen: number[] = [];
      const start = Date.now();
      while (Date.now() - start < timeout) {
        const response = await this.page.waitForResponse(resp => matches(resp.url()), { timeout: Math.max(500, timeout / atLeast) });
        seen.push(response.status());
        if (expectedStatuses) {
          expect(expectedStatuses).toContain(response.status());
        }
        if (seen.length >= atLeast) break;
      }
      expect(seen.length).toBeGreaterThanOrEqual(atLeast);
    });
  }

  async expectAttribute(target: string, name: string, value: string | RegExp) {
    const matcher = normalizeRegex(value) || value;
    await this.runWithArtifacts(`expect-attr-${name}-${target}`, async () => {
      await expect(this.page.locator(target)).toHaveAttribute(name, matcher, { timeout: this.config.defaultTimeout });
    });
  }

  async expectCount(target: string, count: number) {
    await this.runWithArtifacts(`expect-count-${target}`, async () => {
      await expect(this.page.locator(target)).toHaveCount(count, { timeout: this.config.defaultTimeout });
    });
  }

  async uploadFile(target: string, files: string | string[]) {
    const absoluteFiles = (Array.isArray(files) ? files : [files]).map(f => path.isAbsolute(f) ? f : path.join(process.cwd(), f));
    await this.runWithArtifacts(`upload-${target}`, async () => {
      await this.page.locator(target).setInputFiles(absoluteFiles, { timeout: this.config.defaultTimeout });
    });
  }

  async expectToast(target: string, value?: string | RegExp) {
    await this.runWithArtifacts(`expect-toast-${target}`, async () => {
      const locator = this.page.locator(target);
      await expect(locator).toBeVisible({ timeout: this.config.defaultTimeout });
      if (value) {
        const matcher = normalizeRegex(value) || value;
        await expect(locator).toContainText(matcher, { timeout: this.config.defaultTimeout });
      }
    });
  }

  async runScenario(steps: ScenarioStep[]) {
    for (const step of steps) {
      const label = step.label || step.action;
      switch (step.action) {
        case 'goto':
          await this.goto(step.target, step.waitUntil);
          break;
        case 'click':
          await this.click(step.target);
          break;
        case 'fill':
          await this.fill(step.target, step.value);
          break;
        case 'fill-form':
          await this.runWithArtifacts(label, async () => this.fillForm(step.fields));
          break;
        case 'expect-visible':
          await this.expectVisible(step.target);
          break;
        case 'expect-text':
          await this.expectText(step.target, step.value, step.asRegex);
          break;
        case 'wait-for-response':
          await this.waitForResponse(step.url, step.status ?? 200);
          break;
        case 'expect-url-contains':
          await this.expectUrlContains(step.value);
          break;
        case 'expect-attribute':
          await this.expectAttribute(step.target, step.name, step.value);
          break;
        case 'expect-count':
          await this.expectCount(step.target, step.count);
          break;
        case 'upload-file':
          await this.uploadFile(step.target, step.files);
          break;
        case 'wait-for-requests':
          await this.waitForRequests(step.url, {
            status: step.status,
            atLeast: step.atLeast,
            timeout: step.timeout
          });
          break;
        case 'expect-toast':
          await this.expectToast(step.target, step.value);
          break;
        default:
          throw new Error(`Unsupported step action: ${(step as any).action}`);
      }
    }
  }

  private resolve(target: string) {
    return isFullUrl(target) ? target : new URL(target, this.config.baseUrl).toString();
  }

  private async runWithArtifacts(label: string, fn: () => Promise<void>) {
    try {
      await fn();
    } catch (error) {
      await this.captureFailure(label);
      throw error;
    }
  }

  private async captureFailure(label: string) {
    if (!this.config.screenshotOnFailure || !this.testInfo) return;
    try {
      const body = await this.page.screenshot({ fullPage: true });
      await this.testInfo.attach(`failure-${label}`, {
        body,
        contentType: 'image/png'
      });
    } catch {
      // avoid masking the original failure
    }
  }
}

export const webSuite = (testInfo?: TestInfo) => {
  const config = loadWebConfig();

  return {
    config,
    hasScenario(name: string) {
      return !!config.scenarios?.[name]?.length;
    },
    create(page: Page) {
      return new WebAutomation(page, config, testInfo);
    },
    async runScenario(page: Page, name: string) {
      const steps = config.scenarios?.[name];
      if (!steps || steps.length === 0) {
        throw new Error(`Scenario "${name}" not found in web.config.json`);
      }
      const automation = new WebAutomation(page, config, testInfo);
      await automation.runScenario(steps);
    }
  };
};
