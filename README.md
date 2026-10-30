# PageSnap

Full-page screenshots in one click (Chrome / Edge / Brave / any Chromium browser, Manifest V3).

## Install (unpacked)
1. Open `chrome://extensions`, turn on **Developer mode**.
2. **Load unpacked** and pick this folder.
3. Click the toolbar icon, or press **Alt+Shift+S** (change it at `chrome://extensions/shortcuts`).

A preview tab opens with **Save** and **Copy** buttons. PNG or JPEG is chosen in the popup.

## How it captures
- Default: Chrome DevTools Protocol (`chrome.debugger`) renders the full page in chunks and stitches them. Chrome shows a "started debugging this browser" bar while it runs; that is expected.
- Fallback (no `chrome.debugger`, or DevTools already attached): scrolls the page, captures each screen, hides fixed/sticky elements after the first frame, and stitches.

## Android
Stock Chrome for Android does not support extensions. Use its built-in
Share > Screenshot > Long screenshot, or load this in a Chromium-based Android browser
that supports Chrome extensions (it will use the scroll-and-stitch fallback if
`chrome.debugger` is missing).

## Limits
Pages over ~100,000 CSS px tall, or 30,000 output px, are scaled down. chrome:// pages and the Web Store cannot be captured.
