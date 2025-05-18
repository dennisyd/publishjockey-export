const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

/**
 * ImageMagic - Upscales images to KDP-compatible resolution
 * 
 * Common KDP sizes at 300 DPI:
 * - 6x9": 1800x2700 pixels minimum, 3600x5400 optimal
 * - 5.5x8.5": 1650x2550 pixels minimum, 3300x5100 optimal
 * - 5x8": 1500x2400 pixels minimum, 3000x4800 optimal
 * - 8.5x11": 2550x3300 pixels minimum, 5100x6600 optimal
 * And many more sizes supported
 */
const KDP_SIZES = {
  '6x9': { width: 3600, height: 5400 },
  '5x8': { width: 3000, height: 4800 },
  '5.06x7.81': { width: 3036, height: 4686 },
  '5.25x8': { width: 3150, height: 4800 },
  '5.5x8.5': { width: 3300, height: 5100 },
  '6.14x9.21': { width: 3684, height: 5526 },
  '6.69x9.61': { width: 4014, height: 5766 },
  '7x10': { width: 4200, height: 6000 },
  '7.44x9.69': { width: 4464, height: 5814 },
  '7.5x9.25': { width: 4500, height: 5550 },
  '8x10': { width: 4800, height: 6000 },
  '8.5x11': { width: 5100, height: 6600 },
};

/**
 * Determine the best target size for upscaling
 * @param {number} originalWidth - Original image width
 * @param {number} originalHeight - Original image height
 * @returns {Object} The target size { width, height }
 */
function determineBestSize(originalWidth, originalHeight) {
  // Calculate aspect ratio
  const aspectRatio = originalHeight / originalWidth;
  
  // Find closest match in KDP sizes
  let bestMatch = { width: 3600, height: 5400 }; // Default to 6x9"
  let minDiff = Number.MAX_VALUE;
  
  for (const size of Object.values(KDP_SIZES)) {
    const sizeRatio = size.height / size.width;
    const diff = Math.abs(aspectRatio - sizeRatio);
    
    if (diff < minDiff) {
      minDiff = diff;
      bestMatch = size;
    }
  }
  
  // If original is already larger than the best match, just return original dimensions
  if (originalWidth >= bestMatch.width && originalHeight >= bestMatch.height) {
    return { width: originalWidth, height: originalHeight };
  }
  
  return bestMatch;
}

/**
 * Upscale an image to KDP-compatible resolution
 * @param {string} inputPath - Path to source image
 * @param {string} outputPath - Path for output image
 * @param {string} bookSize - Book size (e.g., '6x9') or 'auto' to determine best fit
 * @returns {Promise<Object>} Result info including dimensions and path
 */
async function upscaleImage(inputPath, outputPath, bookSize = 'auto') {
  try {
    // Get image metadata
    const metadata = await sharp(inputPath).metadata();
    
    // Determine target size
    let targetWidth, targetHeight;
    
    if (bookSize !== 'auto' && KDP_SIZES[bookSize]) {
      // Use specified book size
      targetWidth = KDP_SIZES[bookSize].width;
      targetHeight = KDP_SIZES[bookSize].height;
    } else {
      // Auto-determine best size
      const bestSize = determineBestSize(metadata.width, metadata.height);
      targetWidth = bestSize.width;
      targetHeight = bestSize.height;
    }
    
    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Upscale image with high quality settings
    await sharp(inputPath)
      .resize(targetWidth, targetHeight, {
        fit: 'fill',
        kernel: 'lanczos3', // High-quality resampling similar to PIL.LANCZOS
      })
      .jpeg({ quality: 100 }) // Use high quality for JPEG output
      .withMetadata({
        density: 300 // Set to 300 DPI
      })
      .toFile(outputPath);
    
    // Return result
    return {
      success: true,
      originalSize: {
        width: metadata.width,
        height: metadata.height
      },
      newSize: {
        width: targetWidth,
        height: targetHeight
      },
      inputPath,
      outputPath
    };
  } catch (error) {
    console.error('ImageMagic error:', error);
    throw new Error(`Failed to upscale image: ${error.message}`);
  }
}

module.exports = {
  upscaleImage,
  determineBestSize,
  KDP_SIZES
}; 