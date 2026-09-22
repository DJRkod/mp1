/*
 * Records the footage for the demo reel by driving the three projects in
 * headless Chrome over the DevTools Protocol, using only Node built-ins.
 *
 *   node scripts/reel/capture.mjs            # all segments
 *   node scripts/reel/capture.mjs mowkoban   # just one
 *
 * Frames land in <system temp>/mp1-reel-frames/<segment>/ with a manifest of
 * timestamps (set REEL_FRAMES to put them elsewhere; keep them out of synced
 * folders, which lock files mid-write). scripts/reel/compose.py turns them into
 * src/assets/reel.mp4.
 *
 * Everything here only looks: Mowkoban is played in its unscored tutorial, Rock,
 * Paper, Cheater never submits a score, and Jukeplox is browsed without
 * queueing, playing, or stopping anything.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const JUKEPLOX_URL = process.env.JUKEPLOX_URL || 'https://jukeplox.lan.rogerburt.com/';
const FRAMES_DIR = process.env.REEL_FRAMES || join(tmpdir(), 'mp1-reel-frames');
const PORT = 9360;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function launch() {
  const profile = mkdtempSync(join(tmpdir(), 'reel-profile-'));
  const chrome = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--disable-gpu', '--mute-audio', 'about:blank',
  ], { stdio: 'ignore' });

  let target;
  for (let attempt = 0; attempt < 50 && !target; attempt += 1) {
    await sleep(200);
    try {
      const pages = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
      target = pages.find((page) => page.type === 'page');
    } catch (error) { /* Chrome is still starting */ }
  }
  if (!target) {
    throw new Error(`Chrome did not start from ${CHROME}`);
  }

  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  const pending = new Map();
  let nextId = 0;
  socket.onmessage = (message) => {
    const data = JSON.parse(message.data);
    const waiter = pending.get(data.id);
    if (waiter) {
      pending.delete(data.id);
      if (data.error) waiter.reject(new Error(data.error.message)); else waiter.resolve(data.result);
    }
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    nextId += 1;
    pending.set(nextId, { resolve, reject });
    socket.send(JSON.stringify({ id: nextId, method, params }));
  });
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setScrollbarsHidden', { hidden: true });

  const page = {
    async size(width, height) {
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    },
    async goto(url, settleMs = 6000) {
      await send('Page.navigate', { url });
      await sleep(settleMs);
    },
    async run(expression) {
      const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
      return result.result.value;
    },
    // Finds the tightest visible element containing `text` and clicks its center
    // with real mouse events, which also produce the pointer events games listen for.
    async clickText(text) {
      const point = await page.run(`(() => {
        const onScreen = (el) => {
          const box = el.getBoundingClientRect();
          return box.width > 0 && box.top >= 0 && box.left >= 0 && box.bottom <= innerHeight && box.right <= innerWidth;
        };
        // A real mouse click cannot reach an off-screen twin of a control (a hidden
        // mobile nav, say), so only elements inside the viewport count.
        const match = [...document.querySelectorAll('button, a, li, div, span')].filter((el) =>
          onScreen(el) && el.children.length <= 1
          && el.textContent.replace(/\s+/g, ' ').trim().includes(${JSON.stringify(text)}));
        // Tightest match first; between equals (a tab and a filter chip with the
        // same label) the one higher on the page wins.
        const size = (el) => el.textContent.trim().length;
        const target = match.sort((a, b) => size(a) - size(b)
          || a.getBoundingClientRect().top - b.getBoundingClientRect().top)[0];
        if (!target) return null;
        const box = (target.closest('button, a') || target).getBoundingClientRect();
        return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
      })()`);
      if (!point) return false;
      await page.click(point.x, point.y);
      return true;
    },
    // Clicks the visible, enabled <button> whose label contains `text`.
    async clickButton(text) {
      const point = await page.run(`(() => {
        const target = [...document.querySelectorAll('button')].filter((el) => !el.disabled
          && el.getBoundingClientRect().width > 0 && el.innerText.includes(${JSON.stringify(text)}))
          .sort((a, b) => a.innerText.length - b.innerText.length)[0];
        if (!target) return null;
        const box = target.getBoundingClientRect();
        return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
      })()`);
      if (!point) return false;
      await page.click(point.x, point.y);
      return true;
    },
    async press(key, keyCode) {
      const event = { key, code: key, windowsVirtualKeyCode: keyCode };
      await send('Input.dispatchKeyEvent', { type: 'keyDown', ...event });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', ...event });
    },
    async click(x, y) {
      const event = { x, y, button: 'left', clickCount: 1 };
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...event });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...event });
    },
    // Takes screenshots continuously while `action` plays out.
    async record(segment, action) {
      const folder = join(FRAMES_DIR, segment);
      rmSync(folder, { recursive: true, force: true });
      mkdirSync(folder, { recursive: true });
      const frames = [];
      let recording = true;
      const started = Date.now();
      const capture = (async () => {
        while (recording) {
          const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 85 });
          const name = `${String(frames.length).padStart(5, '0')}.jpg`;
          writeFileSync(join(folder, name), Buffer.from(shot.data, 'base64'));
          frames.push({ file: name, ms: Date.now() - started });
          // Back-to-back screenshots starve input events (a mouse release can wait
          // seconds), so leave the page a gap to breathe between frames.
          await sleep(35);
        }
      })();
      await action();
      recording = false;
      await capture;
      writeFileSync(join(folder, 'manifest.json'), JSON.stringify(frames));
      const seconds = (frames[frames.length - 1].ms / 1000).toFixed(1);
      console.log(`${segment}: ${frames.length} frames over ${seconds}s`);
    },
    async close() {
      try { await send('Browser.close'); } catch (error) { /* already closed */ }
      chrome.kill();
      await sleep(800);
      // Chrome can hold the profile open for a moment; a leftover temp folder is harmless.
      try { rmSync(profile, { recursive: true, force: true }); } catch (error) { /* leave it */ }
    },
  };
  return page;
}

const SEGMENTS = {
  async rockpapercheater(page) {
    // The game is a tall card, so it gets a taller window than the others.
    await page.size(1600, 900);
    await page.goto('https://rockpapercheater.com/', 7000);
    await page.record('rockpapercheater', async () => {
      await sleep(1600);
      await page.clickButton('Play');
      await sleep(1300);
      // Each move runs a "1, 2, 3, POW!" countdown before the result appears.
      for (const [move, followUp] of [['Paper', 'Next Round'], ['Rock', 'Next Round'], ['Scissors', 'Accuse of Cheating']]) {
        await page.clickButton(move);
        await sleep(2700);
        if (!(await page.clickButton(followUp))) break;
        await sleep(followUp === 'Next Round' ? 900 : 2600);
      }
    });
  },

  async mowkoban(page) {
    // Taller than 720p so the whole tutorial, controls included, is in frame.
    await page.size(1600, 900);
    await page.goto('https://mowkoban.com/#/tutorial', 6000);
    // The tutorial's optimal nine-move route; tall grass is crossed twice.
    const route = ['ArrowDown', 'ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowUp', 'ArrowDown'];
    const keyCodes = { ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40 };
    await page.record('mowkoban', async () => {
      await sleep(1300);
      for (const key of route) {
        await page.press(key, keyCodes[key]);
        await sleep(520);
      }
      await sleep(2200);
    });
  },

  async jukeplox(page) {
    await page.size(1280, 720);
    await page.goto(JUKEPLOX_URL, 6000);
    const waitForLoad = async () => {
      for (let i = 0; i < 20 && await page.run(`document.body.innerText.includes('Loading')`); i += 1) {
        await sleep(1500);
      }
    };
    const scrollTo = (fraction) => page.run(`(() => {
      const pane = document.querySelector('.browse-surface');
      pane.scrollTop = Math.round(pane.scrollHeight * ${fraction});
    })()`);
    const glide = async (pixels, steps) => {
      for (let step = 0; step < steps; step += 1) {
        await page.run(`document.querySelector('.browse-surface').scrollTop += ${pixels / steps}`);
        await sleep(40);
      }
    };
    const scheme = (name) => page.run(`(() => {
      const button = [...document.querySelectorAll('button')].find((el) =>
        (el.getAttribute('aria-label') || el.title || el.textContent || '').includes(${JSON.stringify(name)}));
      if (button) button.click();
    })()`);
    // The tabs ignore synthesized mouse presses, so they get a DOM click instead.
    const openTab = async (name) => {
      const active = await page.run(`(() => {
        const tab = [...document.querySelectorAll('.tab')].find((el) => el.textContent.trim() === ${JSON.stringify(name)});
        if (tab) tab.click();
        return [...document.querySelectorAll('.tab')].filter((el) => el.className.includes('active'))
          .map((el) => el.textContent.trim()).join(',');
      })()`);
      if (active !== name) throw new Error(`Jukeplox tab ${name} did not open (active: ${active})`);
    };
    const openSettings = () => page.run(`(document.getElementById('appearance-gear')
      || document.querySelector('[name=appearance-gear]')).click()`);

    // Display preferences for this throwaway browser profile: tiles, Bloody Pink.
    await openSettings();
    await sleep(1000);
    await page.clickButton('Tiles');
    await scheme('Bloody Pink');
    await sleep(600);
    await page.press('Escape', 27);
    await page.click(640, 20);
    // Slide the recently-played strip along, then warm the image cache for both views.
    await page.run(`(() => {
      const strip = [...document.querySelectorAll('*')].find((el) => el.scrollWidth > el.clientWidth + 100
        && el.getBoundingClientRect().left < 250 && el.getBoundingClientRect().top > 300);
      if (strip) strip.scrollLeft = 1100;
    })()`);
    for (const [tab, fraction] of [['Albums', 0.33], ['Artists', 0.72]]) {
      await openTab(tab);
      await waitForLoad();
      await scrollTo(fraction);
      await sleep(2500);
      await glide(700, 10);
      await sleep(4000);
      await scrollTo(fraction);
    }
    await sleep(1500);

    await page.record('jukeplox', async () => {
      await sleep(900);
      await glide(620, 45);
      await sleep(500);
      await openTab('Albums');
      await waitForLoad();
      await scrollTo(0.33);
      await sleep(1200);
      await glide(560, 40);
      await sleep(500);
      await openSettings();
      await sleep(900);
      for (const name of ['Tubular Blue', 'Onion Green', 'After the Gold', 'Bloody Pink']) {
        await scheme(name);
        await sleep(950);
      }
      await sleep(400);
    });
  },
};

const wanted = process.argv.slice(2);
const page = await launch();
try {
  for (const [name, capture] of Object.entries(SEGMENTS)) {
    if (wanted.length === 0 || wanted.includes(name)) {
      await capture(page);
    }
  }
} finally {
  await page.close();
}
