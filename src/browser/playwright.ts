import * as fs from 'node:fs';
import * as path from 'node:path';
import { createRequire } from 'node:module';

const _require = createRequire(import.meta.url);

export interface BrowserConfig {
  headless: boolean;
  viewport: { width: number; height: number };
  timeout: number;
  screenshotDir: string;
}

export interface BrowserAction {
  type: 'goto' | 'click' | 'type' | 'select' | 'screenshot' | 'inspect' | 'wait' | 'evaluate';
  selector?: string;
  value?: string;
  url?: string;
  script?: string;
  waitFor?: number;
}

export interface DOMElement {
  tag: string;
  text: string;
  attributes: Record<string, string>;
  visible: boolean;
  children: DOMElement[];
}

export interface ScreenshotResult {
  path: string;
  width: number;
  height: number;
  timestamp: number;
}

const defaultConfig: BrowserConfig = {
  headless: true,
  viewport: { width: 1280, height: 800 },
  timeout: 30000,
  screenshotDir: '.lovecode/screenshots',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let currentBrowser: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let currentPage: any = null;
let config: BrowserConfig = { ...defaultConfig };

function playwrightAvailable(): boolean {
  try {
    _require.resolve('playwright');
    return true;
  } catch {
    return false;
  }
}

export function isPlaywrightAvailable(): boolean {
  return playwrightAvailable();
}

export async function launchBrowser(cfg?: Partial<BrowserConfig>): Promise<void> {
  if (!isPlaywrightAvailable()) {
    throw new Error('Playwright not installed. Run: npm install playwright && npx playwright install chromium');
  }
  config = { ...defaultConfig, ...cfg };
  if (currentBrowser) await closeBrowser();

  // @ts-expect-error - playwright is optional, catch at runtime
  const { chromium } = await import('playwright');
  const headless = config.headless;
  currentBrowser = await chromium.launch({ headless });
  currentPage = await currentBrowser.newPage();
  await currentPage.setViewportSize(config.viewport);
}

export async function closeBrowser(): Promise<void> {
  if (currentBrowser) {
    await currentBrowser.close().catch(() => {});
    currentBrowser = null;
    currentPage = null;
  }
}

export function isBrowserRunning(): boolean {
  return currentBrowser !== null && currentPage !== null;
}

export async function goto(url: string, timeout?: number): Promise<string> {
  ensurePage();
  await currentPage.goto(url, { waitUntil: 'networkidle', timeout: timeout || config.timeout });
  return `Navigated to ${url}`;
}

export async function click(selector: string): Promise<string> {
  ensurePage();
  await currentPage.waitForSelector(selector, { timeout: config.timeout });
  await currentPage.click(selector);
  return `Clicked: ${selector}`;
}

export async function type(selector: string, text: string): Promise<string> {
  ensurePage();
  await currentPage.waitForSelector(selector, { timeout: config.timeout });
  await currentPage.fill(selector, text);
  return `Typed "${text}" into ${selector}`;
}

export async function select(selector: string, value: string): Promise<string> {
  ensurePage();
  await currentPage.waitForSelector(selector, { timeout: config.timeout });
  await currentPage.selectOption(selector, value);
  return `Selected "${value}" in ${selector}`;
}

export async function screenshot(name?: string): Promise<ScreenshotResult> {
  ensurePage();
  const screenshotDir = config.screenshotDir;
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }
  const timestamp = Date.now();
  const fileName = name ? `${name}-${timestamp}.png` : `screenshot-${timestamp}.png`;
  const filePath = path.join(screenshotDir, fileName);
  await currentPage.screenshot({ path: filePath, fullPage: true });
  return { path: filePath, width: config.viewport.width, height: config.viewport.height, timestamp };
}

export async function inspect(selector: string): Promise<DOMElement | null> {
  ensurePage();
  await currentPage.waitForSelector(selector, { timeout: config.timeout });
  const script = `
    (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      function describe(node) {
        return {
          tag: node.tagName.toLowerCase(),
          text: (node.textContent || '').slice(0, 200),
          attributes: Object.fromEntries(Array.from(node.attributes).map(a => [a.name, a.value])),
          visible: node.offsetParent !== null,
          children: Array.from(node.children).map(c => describe(c)),
        };
      }
      return describe(el);
    }
  `;
  const result = await currentPage.evaluate(new Function('sel', `return (${script})(sel);`), selector);
  return result || null;
}

export async function getHTML(selector?: string): Promise<string> {
  ensurePage();
  if (selector) {
    const script = `document.querySelector("${selector}") ? document.querySelector("${selector}").outerHTML : 'Element not found'`;
    return await currentPage.evaluate(script);
  }
  return await currentPage.evaluate('document.documentElement.outerHTML');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function evaluate(script: string): Promise<any> {
  ensurePage();
  return await currentPage.evaluate(script);
}

export async function waitFor(ms: number): Promise<void> {
  ensurePage();
  await currentPage.waitForTimeout(ms);
}

export async function runActions(actions: BrowserAction[]): Promise<string[]> {
  const results: string[] = [];
  for (const action of actions) {
    switch (action.type) {
      case 'goto':
        results.push(await goto(action.url!));
        break;
      case 'click':
        results.push(await click(action.selector!));
        break;
      case 'type':
        results.push(await type(action.selector!, action.value!));
        break;
      case 'select':
        results.push(await select(action.selector!, action.value!));
        break;
      case 'screenshot':
        results.push(`Screenshot saved: ${(await screenshot(action.value)).path}`);
        break;
      case 'inspect':
        results.push(JSON.stringify(await inspect(action.selector!), null, 2));
        break;
      case 'wait':
        await waitFor(action.waitFor || 1000);
        results.push(`Waited ${action.waitFor || 1000}ms`);
        break;
      case 'evaluate':
        results.push(String(await evaluate(action.script!)));
        break;
    }
  }
  return results;
}

export function formatScreenshotResult(result: ScreenshotResult): string {
  return `Screenshot: ${result.path} (${result.width}x${result.height})`;
}

export function formatDOMElement(el: DOMElement, indent: number = 0): string {
  const pad = '  '.repeat(indent);
  const attrs = Object.entries(el.attributes).map(([k, v]) => `${k}="${v}"`).join(' ');
  const visible = el.visible ? '' : ' [hidden]';
  const text = el.text ? ` "${el.text.slice(0, 60)}"` : '';
  let result = `${pad}<${el.tag}${attrs ? ' ' + attrs : ''}>${text}${visible}`;
  for (const child of el.children.slice(0, 10)) {
    result += '\n' + formatDOMElement(child, indent + 1);
  }
  if (el.children.length > 10) {
    result += `\n${pad}  ... and ${el.children.length - 10} more children`;
  }
  return result;
}

function ensurePage(): void {
  if (!currentPage) throw new Error('Browser not launched. Call lovecode browser start first.');
}
