// Downscales an image file client-side before upload — a phone photo can
// easily be 4000px/8MB, and there's no reason to spend a mobile connection's
// bandwidth (or Cloudinary's free-tier storage) on pixels no view of this
// site will ever render at. Uses the browser's own <canvas> API, not a
// library — this is a one-shot resize, not something that needs a
// full image-processing dependency.
export async function resizeImageFile(
    file: File,
    maxDimension: number = 1600,
    quality: number = 0.85
): Promise<File> {
    const bitmap = await createImageBitmap(file);

    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    // Already small enough — skip re-encoding, which would only lose
    // quality for no size benefit.
    if (scale === 1) {
        bitmap.close();
        return file;
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
        // Extremely unlikely (2d context is universally supported), but if
        // it ever happens, uploading the original file is a better failure
        // mode than blocking the upload entirely.
        bitmap.close();
        return file;
    }

    ctx.drawImage(bitmap, 0, 0, width, height);
    // A decoded phone photo can hold tens of MB until garbage-collected —
    // release it as soon as it's been drawn.
    bitmap.close();

    const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", quality)
    );

    if (!blob) {
        return file;
    }

    return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
}
