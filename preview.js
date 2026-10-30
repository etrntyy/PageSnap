const infoEl = document.getElementById('info');
const imgEl = document.getElementById('img');

function readShot() {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('pagesnap', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('shots');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const req = open.result.transaction('shots').objectStore('shots').get('latest');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    };
  });
}

readShot().then((shot) => {
  if (!shot) {
    infoEl.textContent = 'No screenshot found.';
    return;
  }
  const url = URL.createObjectURL(shot.blob);
  imgEl.src = url;
  infoEl.textContent = `${shot.name} - ${shot.width} x ${shot.height}px - ${(shot.blob.size / 1048576).toFixed(1)} MB`;

  document.getElementById('save').addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = url;
    a.download = shot.name;
    a.click();
  });

  document.getElementById('copy').addEventListener('click', async (ev) => {
    const btn = ev.currentTarget;
    try {
      // The clipboard only reliably accepts PNG, so re-encode JPEGs.
      let png = shot.blob;
      if (png.type !== 'image/png') {
        const bmp = await createImageBitmap(shot.blob);
        const c = new OffscreenCanvas(bmp.width, bmp.height);
        c.getContext('2d').drawImage(bmp, 0, 0);
        png = await c.convertToBlob({ type: 'image/png' });
      }
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
      btn.textContent = 'Copied';
    } catch {
      btn.textContent = 'Copy failed';
    }
    setTimeout(() => (btn.textContent = 'Copy'), 2000);
  });
});
