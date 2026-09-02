/**
 * Compress an image file on the client-side using HTML Canvas.
 * Reduces 5MB-15MB camera photos to ~200KB-400KB with crystal clarity,
 * preventing Nginx/Cloudflare 413 Entity Too Large errors and speeding up WhatsApp delivery.
 */
export async function compressImageFile(file, maxWidth = 1600, maxHeight = 1600, quality = 0.85) {
  if (!file || !file.type.startsWith('image/')) return file;
  if (file.size < 300 * 1024) return file;

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }
            const compressedFile = new File(
              [blob],
              file.name.replace(/\.[^.]+$/, '.jpg'),
              {
                type: 'image/jpeg',
                lastModified: Date.now()
              }
            );
            resolve(compressedFile);
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => resolve(file);
      img.src = event.target.result;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

export async function uploadSingleOrMultipleImages(files) {
  if (!files || files.length === 0) return [];

  const uploadedUrls = [];

  for (const rawFile of files) {
    const file = await compressImageFile(rawFile);
    const formData = new FormData();
    formData.append('file', file);

    const uploadRes = await fetch('/api/uploads/campaign-image', {
      method: 'POST',
      body: formData
    });

    const text = await uploadRes.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      if (uploadRes.status === 413 || text.includes('413') || text.includes('Too Large')) {
        throw new Error(`Image "${file.name}" is too large for the server limit. Please use a smaller image.`);
      }
      throw new Error(`Upload failed (Status ${uploadRes.status}): Server returned invalid response`);
    }

    if (!uploadRes.ok) {
      throw new Error(data.error || 'Failed to upload image');
    }

    const fileUrl = data.url || (data.urls && data.urls[0]);
    if (fileUrl) {
      uploadedUrls.push(fileUrl);
    }
  }

  return uploadedUrls;
}
