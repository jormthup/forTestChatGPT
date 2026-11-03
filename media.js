// Resize uploads to keep single-device browser storage practical. No remote uploads.
export async function readImage(
  file,
  { size = 640, quality = 0.82, qr = false } = {},
) {
  if (!file) return "";
  if (
    !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
    file.size > 8 * 1024 * 1024
  )
    throw Error("ใช้รูป PNG/JPEG/WebP ขนาดไม่เกิน 8 MB");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (image.naturalWidth * image.naturalHeight > 40000000)
      throw Error("รูปมีความละเอียดสูงเกินไป");
    const ratio = Math.min(
      1,
      size / Math.max(image.naturalWidth, image.naturalHeight),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL(qr ? "image/png" : "image/webp", quality);
  } catch (error) {
    throw Error(error.message || "อ่านรูปไม่ได้ กรุณาเลือกรูปใหม่");
  } finally {
    URL.revokeObjectURL(url);
  }
}
