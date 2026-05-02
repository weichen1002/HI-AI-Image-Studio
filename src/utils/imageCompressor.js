export async function compressImage(file, maxSizeMB = 1) {
  if (!file || !file.type.startsWith('image/')) return file;
  
  // If file is already smaller than the target size, return it directly
  if (file.size <= maxSizeMB * 1024 * 1024) return file;

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      
      // Calculate new dimensions to ensure max dimension is ~2048 to save memory
      const maxDim = 2048;
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      
      // Try to compress to JPEG with 0.8 quality
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file); // fallback
            return;
          }
          const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, ".jpg"), {
            type: 'image/jpeg',
            lastModified: Date.now()
          });
          resolve(compressedFile);
        },
        'image/jpeg',
        0.8
      );
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file); // fallback on error
    };
    
    img.src = url;
  });
}
