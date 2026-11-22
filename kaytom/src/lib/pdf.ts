export interface ScanPage { id: string; src: string; rot: 0 | 90 | 180 | 270; bw: boolean }

async function render(p: ScanPage, maxDim = 1800): Promise<string> {
  const img = new Image(); img.src = p.src; await img.decode();
  const sw = p.rot % 180 ? img.height : img.width, sh = p.rot % 180 ? img.width : img.height;
  const k = Math.min(1, maxDim / Math.max(sw, sh));
  const c = document.createElement('canvas'); c.width = Math.round(sw * k); c.height = Math.round(sh * k);
  const x = c.getContext('2d')!;
  x.translate(c.width / 2, c.height / 2); x.rotate((p.rot * Math.PI) / 180);
  x.drawImage(img, (-img.width * k) / 2, (-img.height * k) / 2, img.width * k, img.height * k);
  if (p.bw) {
    x.setTransform(1, 0, 0, 1, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height);
    for (let i = 0; i < d.data.length; i += 4) {
      const g = 0.299 * d.data[i] + 0.587 * d.data[i + 1] + 0.114 * d.data[i + 2];
      const v = Math.max(0, Math.min(255, (g - 128) * 1.6 + 140));
      d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
    }
    x.putImageData(d, 0, 0);
  }
  return c.toDataURL('image/jpeg', 0.85);
}

export async function buildPdf(pages: ScanPage[]): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  for (let i = 0; i < pages.length; i++) {
    const data = await render(pages[i]);
    const im = new Image(); im.src = data; await im.decode();
    const r = Math.min(W / im.width, H / im.height);
    const w = im.width * r, h = im.height * r;
    if (i > 0) doc.addPage();
    doc.addImage(data, 'JPEG', (W - w) / 2, (H - h) / 2, w, h);
  }
  return doc.output('blob');
}
