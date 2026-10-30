// Full-page capture. Preferred path: Chrome DevTools Protocol via chrome.debugger
// (renders beyond the viewport, no repeated sticky headers). Fallback: scroll and
// stitch captureVisibleTab frames, for browsers without chrome.debugger.

const MAX_CHUNK_PX = 8000; // per-capture pixel height, stays under GPU texture limits
const MAX_CANVAS_H = 30000;
const MAX_CANVAS_AREA = 200e6;
const MAX_CSS_HEIGHT = 100000;

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== 'capture') return;
  chrome.tabs.query({ active: true, currentWindow: true }).then(async ([tab]) => {
    try {
      await capture(tab, msg);
      sendResponse({ ok: true });
    } catch (e) {
      sendResponse({ ok: false, error: String(e?.message || e) });
    }
  });
  return true;
});

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command !== 'capture-full-page') return;
  const { format = 'png' } = await chrome.storage.local.get('format');
  capture(tab, { mode: 'full', format }).catch((e) => flashBadge(tab.id, '!', String(e)));
});

async function capture(tab, { mode, format }) {
  if (!tab?.id || !/^(https?|file|ftp):/.test(tab.url || '')) {
    throw new Error('Chrome does not allow screenshots of this kind of page.');
  }
  await chrome.action.setBadgeText({ tabId: tab.id, text: '...' });
  try {
    let canvas;
    if (mode === 'visible') {
      canvas = await captureVisible(tab);
    } else if (chrome.debugger) {
      try {
        canvas = await captureWithDebugger(tab.id);
      } catch (e) {
        console.warn('debugger capture failed, falling back to scrolling', e);
        canvas = await captureByScrolling(tab);
      }
    } else {
      canvas = await captureByScrolling(tab);
    }

    const jpeg = format === 'jpeg';
    const blob = await canvas.convertToBlob(
      jpeg ? { type: 'image/jpeg', quality: 0.92 } : { type: 'image/png' }
    );
    const host = new URL(tab.url).hostname.replace(/^www\./, '') || 'page';
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    await saveShot({ blob, name: `${host}-${stamp}.${jpeg ? 'jpg' : 'png'}`, width: canvas.width, height: canvas.height });
    await chrome.tabs.create({ url: chrome.runtime.getURL('preview.html'), index: tab.index + 1 });
  } finally {
    chrome.action.setBadgeText({ tabId: tab.id, text: '' });
  }
}

function flashBadge(tabId, text, title) {
  chrome.action.setBadgeText({ tabId, text });
  chrome.action.setTitle({ tabId, title });
  setTimeout(() => chrome.action.setBadgeText({ tabId, text: '' }), 4000);
}

// ---------- debugger (CDP) path ----------

async function captureWithDebugger(tabId) {
  const target = { tabId };
  await chrome.debugger.attach(target, '1.3');
  try {
    const send = (method, params) => chrome.debugger.sendCommand(target, method, params);

    // Scroll through once so lazy-loaded images and sections render.
    await send('Runtime.evaluate', {
      awaitPromise: true,
      expression: `(async () => {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const h = Math.min(document.documentElement.scrollHeight, ${MAX_CSS_HEIGHT});
        for (let y = 0, i = 0; y < h && i < 80; y += innerHeight, i++) {
          scrollTo({ top: y, behavior: 'instant' });
          await wait(120);
        }
        scrollTo({ top: 0, behavior: 'instant' });
        await wait(200);
      })()`,
    });

    const { cssContentSize } = await send('Page.getLayoutMetrics');
    const { result } = await send('Runtime.evaluate', { expression: 'window.devicePixelRatio' });
    // cssContentSize can under-report width on pages with horizontal overflow, so take the widest measure.
    const { result: dims } = await send('Runtime.evaluate', {
      returnByValue: true,
      expression: `({
        w: Math.max(document.documentElement.scrollWidth, document.body ? document.body.scrollWidth : 0, innerWidth),
        h: Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0),
      })`,
    });
    const width = Math.ceil(Math.max(cssContentSize.width, dims.value.w));
    const height = Math.min(Math.ceil(Math.max(cssContentSize.height, dims.value.h)), MAX_CSS_HEIGHT);
    const scale = Math.min(result.value || 1, MAX_CANVAS_H / height, Math.sqrt(MAX_CANVAS_AREA / (width * height)));

    const canvas = new OffscreenCanvas(Math.round(width * scale), Math.round(height * scale));
    const ctx = canvas.getContext('2d');
    const chunkH = Math.max(1, Math.floor(MAX_CHUNK_PX / scale));

    for (let y = 0; y < height; y += chunkH) {
      const h = Math.min(chunkH, height - y);
      const { data } = await send('Page.captureScreenshot', {
        format: 'png',
        fromSurface: true,
        captureBeyondViewport: true,
        clip: { x: 0, y, width, height: h, scale },
      });
      const bitmap = await createImageBitmap(await (await fetch('data:image/png;base64,' + data)).blob());
      // Size the piece explicitly so a different native bitmap size can't crop or shift it.
      ctx.drawImage(bitmap, 0, Math.round(y * scale), canvas.width, Math.round(h * scale));
      bitmap.close();
    }
    return canvas;
  } finally {
    await chrome.debugger.detach(target).catch(() => {});
  }
}

// ---------- scroll-and-stitch path ----------

async function captureVisible(tab) {
  const bitmap = await grabFrame(tab.windowId);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  canvas.getContext('2d').drawImage(bitmap, 0, 0);
  return canvas;
}

async function grabFrame(windowId) {
  const dataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: 'png' });
  return createImageBitmap(await (await fetch(dataUrl)).blob());
}

async function inPage(tabId, func, args = []) {
  const [res] = await chrome.scripting.executeScript({ target: { tabId }, func, args });
  return res.result;
}

async function captureByScrolling(tab) {
  const tabId = tab.id;
  const m = await inPage(tabId, () => ({
    vw: innerWidth,
    vh: innerHeight,
    total: Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0),
    startY: scrollY,
  }));
  const total = Math.min(m.total, MAX_CSS_HEIGHT);

  let canvas, ctx, scale;
  try {
    for (let y = 0; y < total; y += m.vh) {
      const actualY = await inPage(tabId, (top) => {
        scrollTo({ top, behavior: 'instant' });
        return scrollY;
      }, [y]);
      await new Promise((r) => setTimeout(r, 600)); // captureVisibleTab allows ~2 calls/second
      const bitmap = await grabFrame(tab.windowId);
      if (!canvas) {
        scale = Math.min(bitmap.width / m.vw, MAX_CANVAS_H / total);
        canvas = new OffscreenCanvas(bitmap.width, Math.round(total * scale));
        ctx = canvas.getContext('2d');
      }
      ctx.drawImage(bitmap, 0, Math.round(actualY * scale));
      bitmap.close();
      if (y === 0) {
        // Hide fixed/sticky elements after the first frame so they don't repeat.
        await inPage(tabId, () => {
          window.__pageSnapHidden = [];
          for (const el of document.querySelectorAll('*')) {
            const p = getComputedStyle(el).position;
            if (p === 'fixed' || p === 'sticky') {
              window.__pageSnapHidden.push([el, el.style.visibility]);
              el.style.visibility = 'hidden';
            }
          }
        });
      }
    }
  } finally {
    await inPage(tabId, (y) => {
      for (const [el, v] of window.__pageSnapHidden || []) el.style.visibility = v;
      window.__pageSnapHidden = [];
      scrollTo({ top: y, behavior: 'instant' });
    }, [m.startY]).catch(() => {});
  }
  return canvas;
}

// ---------- hand-off to the preview page via IndexedDB ----------

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('pagesnap', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('shots');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveShot(shot) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction('shots', 'readwrite');
    tx.objectStore('shots').put(shot, 'latest');
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
