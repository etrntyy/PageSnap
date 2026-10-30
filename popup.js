const formatEl = document.getElementById('format');
const statusEl = document.getElementById('status');
const buttons = document.querySelectorAll('button');

chrome.storage.local.get('format').then(({ format }) => {
  if (format) formatEl.value = format;
});
formatEl.addEventListener('change', () => chrome.storage.local.set({ format: formatEl.value }));

async function run(mode) {
  buttons.forEach((b) => (b.disabled = true));
  statusEl.className = '';
  statusEl.textContent = mode === 'full' ? 'Capturing, keep this tab open...' : 'Capturing...';
  const res = await chrome.runtime.sendMessage({ type: 'capture', mode, format: formatEl.value });
  if (res?.ok) {
    window.close();
  } else {
    statusEl.className = 'err';
    statusEl.textContent = res?.error || 'Capture failed.';
    buttons.forEach((b) => (b.disabled = false));
  }
}

document.getElementById('full').addEventListener('click', () => run('full'));
document.getElementById('visible').addEventListener('click', () => run('visible'));
