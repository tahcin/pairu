// Prepares a photo on the phone before upload. A JPEG that is already at most 1024 px on its longest
// side (and under 1.5 MB) is sent byte for byte, with no re-encoding, so no quality is lost. Anything
// larger, or any other format, is drawn once onto a canvas at most 1024 px and saved as JPEG.
// Returns the base64 payload (no data: prefix) and a data URL for the preview.
function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export async function compressImage(file: File, max = 1024, quality = 0.85): Promise<{ base64: string; preview: string }> {
  let bitmap: ImageBitmap | HTMLImageElement;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    bitmap = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }
  const w = bitmap.width;
  const h = bitmap.height;
  if (file.type === "image/jpeg" && Math.max(w, h) <= max && file.size <= 1_500_000) {
    const dataUrl = await readAsDataUrl(file);
    return { base64: dataUrl.split(",")[1], preview: dataUrl };
  }
  const scale = Math.min(1, max / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  return { base64: dataUrl.split(",")[1], preview: dataUrl };
}
