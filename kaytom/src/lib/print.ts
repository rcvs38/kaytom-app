import { Capacitor } from '@capacitor/core';

const toBase64 = (b: Blob) => new Promise<string>((res, rej) => {
  const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(b);
});

/** Telefonda: sistem paylaşım menüsü (kullanıcı "Yazdır" veya istediği uygulamayı seçer). Web/Masaüstü: sistem yazdırma penceresi. */
export async function printFile(blob: Blob, name: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');
    const r = await Filesystem.writeFile({ path: name, data: await toBase64(blob), directory: Directory.Cache });
    await Share.share({ title: name, url: r.uri, dialogTitle: name });
    return;
  }
  const url = URL.createObjectURL(blob);
  const f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  const cleanup = () => setTimeout(() => { f.remove(); URL.revokeObjectURL(url); }, 120_000);
  if (blob.type.startsWith('image/')) {
    f.srcdoc = `<html><body style="margin:0"><img src="${url}" style="max-width:100%" onload="setTimeout(()=>print(),150)"></body></html>`;
    document.body.appendChild(f); cleanup();
  } else {
    f.src = url; document.body.appendChild(f);
    f.onload = () => { try { f.contentWindow?.focus(); f.contentWindow?.print(); } catch { window.open(url, '_blank'); } };
    cleanup();
  }
}
