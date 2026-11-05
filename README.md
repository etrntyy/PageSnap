# PageSnap

Capture a whole web page, top to bottom, as one image. One click, then save or copy it.

[![Download PageSnap](https://img.shields.io/badge/Download-PageSnap.zip-3b6cf6?style=for-the-badge)](https://github.com/etrntyy/PageSnap/releases/latest/download/PageSnap.zip)

Prefer the unzipped files? They are right here in this repository (`manifest.json`, `background.js` and the rest), or use **Code > Download ZIP** on this page.

## Install (about 1 minute)

1. **Download** the zip with the blue button above, then unzip it. Keep the unzipped folder somewhere permanent.
2. In your browser, open `chrome://extensions` (Edge: `edge://extensions`).
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and choose the unzipped folder, the one that has `manifest.json` directly inside.
5. Click the puzzle-piece icon in the toolbar and pin **PageSnap**.

## Use it

- Click the PageSnap icon, then **Capture full page**.
- Or press **Alt+Shift+S** (change it at `chrome://extensions/shortcuts`).
- A new tab opens with your screenshot. Click **Save** or **Copy**. PNG or JPEG is chosen in the popup.

While a full-page capture runs, Chrome shows a "started debugging this browser" bar. That is expected.

## Supports

| Where | Works? |
| --- | --- |
| Windows, macOS and Linux desktop browsers built on Chromium: Chrome, Edge, Brave, Opera, Vivaldi, Arc | Yes |
| Chrome on Android | No. Chrome for Android cannot run extensions at all. |

On Android, use Chrome's built-in long screenshot instead: **Share > Screenshot > Long screenshot**.

## How it captures

- Default: Chrome DevTools Protocol (`chrome.debugger`) renders the full page in chunks and stitches them.
- Fallback (no `chrome.debugger`, or DevTools already attached): scrolls the page, captures each screen, hides fixed and sticky elements after the first frame, and stitches.

## Limits

Pages over about 100,000 CSS px tall, or 30,000 output px, are scaled down. `chrome://` pages and the Chrome Web Store cannot be captured.

## Say thanks

If PageSnap saves you time, you can [buy me a coffee](https://buymeacoffee.com/etrntyy).
