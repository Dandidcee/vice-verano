import {spawn} from 'node:child_process';
import {mkdtempSync, readdirSync, mkdirSync, unlinkSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:net';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const CHROME = '/root/.hermes/tools/chromium-1208/chrome-linux64/chrome';
const PORT = Number(process.env.VICE_PORT || 8081);
const GAME_URL = `http://127.0.0.1:${PORT}/`;
const SCREEN_DIR = join(ROOT, 'screenshots');
const MAX_BYTES = 256 * 1024;
const sleep = (milliseconds) => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));

async function findFreePort() {
  return new Promise((resolvePromise, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolvePromise(port));
    });
  });
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

async function waitForUrl(url, timeout = 8000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      await fetch(url);
      return;
    } catch {
      await sleep(100);
    }
  }
  throw new Error(`Timed out waiting for ${url}`);
}

class DevToolsPage {
  constructor(webSocketUrl) {
    this.nextId = 0;
    this.pending = new Map();
    this.socket = new WebSocket(webSocketUrl);
    this.opened = new Promise((resolvePromise, reject) => {
      this.socket.addEventListener('open', resolvePromise, {once: true});
      this.socket.addEventListener('error', reject, {once: true});
    });
    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data));
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
    });
  }

  async command(method, params = {}) {
    await this.opened;
    const id = ++this.nextId;
    return new Promise((resolvePromise, reject) => {
      this.pending.set(id, {resolve: resolvePromise, reject});
      this.socket.send(JSON.stringify({id, method, params}));
    });
  }

  async evaluate(expression) {
    const result = await this.command('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true});
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Runtime evaluation failed');
    return result.result?.value;
  }

  close() {
    if (this.socket.readyState === WebSocket.OPEN) this.socket.close();
  }
}

async function waitFor(page, expression, timeout = 8000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await page.evaluate(expression)) return;
    await sleep(80);
  }
  throw new Error(`Timed out waiting for ${expression}`);
}

async function capture(page, filename) {
  for (const quality of [72, 60, 48, 38]) {
    const result = await page.command('Page.captureScreenshot', {format: 'jpeg', quality, fromSurface: true});
    const bytes = Buffer.from(result.data, 'base64');
    if (bytes.length <= MAX_BYTES) {
      writeFileSync(join(SCREEN_DIR, filename), bytes);
      return bytes.length;
    }
  }
  throw new Error(`${filename} exceeded ${MAX_BYTES} bytes at every JPEG quality`);
}

async function main() {
  mkdirSync(SCREEN_DIR, {recursive: true});
  for (const filename of readdirSync(SCREEN_DIR)) {
    if (/\.(?:jpe?g|png)$/i.test(filename)) unlinkSync(join(SCREEN_DIR, filename));
  }

  let server = null;
  let chrome = null;
  let page = null;
  let profile = null;
  try {
    try {
      await waitForUrl(GAME_URL, 900);
    } catch {
      server = spawn(process.execPath, ['serve.ts', '--port', String(PORT)], {cwd: ROOT, stdio: 'ignore'});
      await waitForUrl(GAME_URL, 8000);
    }

    const debugPort = await findFreePort();
    profile = mkdtempSync(join(tmpdir(), 'vice-verano-shots-'));
    chrome = spawn(CHROME, [
      '--headless=new', '--no-sandbox', '--disable-gpu', '--enable-unsafe-swiftshader', '--use-angle=swiftshader',
      `--remote-debugging-port=${debugPort}`, '--remote-debugging-address=127.0.0.1', '--window-size=1280,720',
      '--hide-scrollbars', `--user-data-dir=${profile}`, 'about:blank',
    ], {stdio: 'ignore'});
    await waitForUrl(`http://127.0.0.1:${debugPort}/json/version`, 8000);
    const targets = await fetchJson(`http://127.0.0.1:${debugPort}/json`);
    const target = targets.find((entry) => entry.type === 'page');
    if (!target) throw new Error('Chrome did not expose a page target');
    page = new DevToolsPage(target.webSocketDebuggerUrl);
    await page.command('Page.enable');
    await page.command('Runtime.enable');
    await page.command('Emulation.setDeviceMetricsOverride', {width: 1280, height: 720, deviceScaleFactor: 1, mobile: false});
    await page.command('Page.navigate', {url: `${GAME_URL}?seed=23`});
    await waitFor(page, 'Boolean(window.__vice && window.__vice.setScene)');

    const scenes = [
      {filename: '1-cover.jpg', scene: 'cover', mission: 1},
      {filename: '2-street.jpg', scene: 'street', mission: 2},
      {filename: '3-chase.jpg', scene: 'chase', mission: 3},
      {filename: '4-dialogue.jpg', scene: 'dialogue'},
    ];
    for (const shot of scenes) {
      await page.evaluate(`window.__vice.setScene(${JSON.stringify(shot.scene)})`);
      if (shot.mission !== undefined) await page.evaluate(`window.__vice.startMission(${shot.mission})`);
      await waitFor(page, 'window.__shotReady === true');
      await sleep(220);
      const bytes = await capture(page, shot.filename);
      console.log(`${shot.filename}: 1280x720 JPEG ${bytes} bytes`);
    }
  } finally {
    page?.close();
    chrome?.kill('SIGTERM');
    server?.kill('SIGTERM');
    if (profile) rmSync(profile, {recursive: true, force: true});
  }
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
