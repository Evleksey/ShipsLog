const MAX_EDGE = 1280;
const JPEG_QUALITY = 0.8;

/**
 * Reads a photo chosen by the user and shrinks it to a JPEG data URL — small enough to travel
 * inside the entry itself, whether that goes to browser storage or to the backend.
 */
export async function readPicture(file) {
  const url = URL.createObjectURL(file);
  try {
    const image = await load(url);
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('The picture has no size.');
    const scale = Math.min(1, MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);
    const context = canvas.getContext('2d');
    context.fillStyle = '#fff'; // JPEG has no transparency
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function load(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('The file is not a picture this browser can read.'));
    image.src = url;
  });
}
