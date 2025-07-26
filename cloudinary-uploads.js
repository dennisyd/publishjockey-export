/**
 * Optimized Cloudinary Solution for PublishJockey
 * Eliminates unnecessary downloads and leverages Cloudinary's power
 * Enhanced with streaming, caching, and direct URL processing
 */

const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const streamifier = require('streamifier');
const https = require('https');
const crypto = require('crypto');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Validate configuration
const config = cloudinary.config();
console.log('[CLOUDINARY] Configuration loaded:');
console.log('[CLOUDINARY] Cloud name:', config.cloud_name ? 'SET' : 'NOT SET');
console.log('[CLOUDINARY] API key:', config.api_key ? 'SET' : 'NOT SET');
console.log('[CLOUDINARY] API secret:', config.api_secret ? 'SET' : 'NOT SET');

if (!config.cloud_name || !config.api_key || !config.api_secret) {
  console.error('[CLOUDINARY ERROR] Missing required environment variables!');
  console.error('[CLOUDINARY ERROR] Required: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET');
  throw new Error('Cloudinary configuration incomplete. Check environment variables.');
}

/**
 * Optimized transformations for different book formats
 * These are applied dynamically via URL, no pre-processing needed
 */
const BOOK_TRANSFORMATIONS = {
  pdf: {
    // High-resolution PNG for crisp PDF embedding
    format: 'png',
    quality: '95',
    flags: 'immutable',
    dpr: '2.0'  // High DPI for print
  },
  epub: {
    // Balanced quality for e-readers
    format: 'jpg',
    quality: '85',
    flags: 'progressive,immutable'
  },
  docx: {
    // Optimized for Word documents
    format: 'png',
    quality: '90',
    flags: 'immutable'
  },
  thumbnail: {
    width: 200,
    height: 200,
    crop: 'fill',
    quality: '75',
    format: 'jpg',
    flags: 'immutable'
  },
  // New: Streaming optimized versions
  stream: {
    format: 'jpg',
    quality: '80',
    flags: 'immutable'
  }
};

/**
 * Generate optimized Cloudinary URL for book formats
 * @param {string} publicId - Cloudinary public ID
 * @param {string} format - Book format
 * @param {Object} customOptions - Additional options
 * @returns {string} Optimized URL
 */
function getOptimizedUrl(publicId, format = 'epub', customOptions = {}) {
  const baseTransform = BOOK_TRANSFORMATIONS[format] || BOOK_TRANSFORMATIONS.epub;
  
  return cloudinary.url(publicId, {
    ...baseTransform,
    ...customOptions,
    secure: true
  });
}

/**
 * Enhanced upload with automatic optimization
 */
function uploadToCloudinary(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    const uploadOptions = {
      resource_type: 'image',
      folder: options.folder || 'publishjockey',
      public_id: options.public_id,
      tags: options.tags || ['publishjockey'],
      // Auto-optimize on upload
      quality: 'auto:good',
      fetch_format: 'auto',
      flags: 'immutable',
      eager: [
        // Pre-generate common formats
        BOOK_TRANSFORMATIONS.pdf,
        BOOK_TRANSFORMATIONS.epub,
        BOOK_TRANSFORMATIONS.thumbnail
      ],
      ...options.cloudinaryOptions
    };

    const uploadStream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) {
          console.error('[CLOUDINARY] Upload error:', error);
          reject(error);
        } else {
          console.log('[CLOUDINARY] Upload success:', result.public_id);
          
          // Pre-generate all format URLs for backward compatibility
          const enhancedResult = {
            ...result,
            urls: {
              pdf: getOptimizedUrl(result.public_id, 'pdf'),
              epub: getOptimizedUrl(result.public_id, 'epub'),
              docx: getOptimizedUrl(result.public_id, 'docx'),
              thumbnail: getOptimizedUrl(result.public_id, 'thumbnail'),
              original: result.secure_url
            },
            // Keep old format for backward compatibility
            optimizedUrls: {
              pdf: getOptimizedUrl(result.public_id, 'pdf'),
              epub: getOptimizedUrl(result.public_id, 'epub'),
              docx: getOptimizedUrl(result.public_id, 'docx'),
              thumbnail: getOptimizedUrl(result.public_id, 'thumbnail')
            }
          };
          
          resolve(enhancedResult);
        }
      }
    );

    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
}

/**
 * OPTIMIZED: Stream image directly to PDF generator
 * No local file creation needed
 */
function streamImageToPDF(imageUrl, options = {}) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    
    const request = https.get(imageUrl, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }
      
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => {
        const buffer = Buffer.concat(chunks);
        console.log(`[CLOUDINARY] Streamed ${buffer.length} bytes for PDF`);
        resolve(buffer);
      });
    });
    
    request.on('error', reject);
    request.setTimeout(options.timeout || 15000, () => {
      request.destroy();
      reject(new Error('Stream timeout'));
    });
  });
}

/**
 * REVOLUTIONARY: Process markdown with direct URLs for modern PDF generators
 * No file downloads needed - works with Puppeteer, Playwright, etc.
 */
function optimizeMarkdownForPDF(markdown, format = 'pdf') {
  console.log('[CLOUDINARY] Optimizing markdown for direct PDF generation');
  
  // Find all Cloudinary URLs with enhanced regex
  const cloudinaryUrlRegex = /https:\/\/res\.cloudinary\.com\/[^)\s"'{}]+/g;
  
  // Also find URLs within LaTeX includegraphics commands
  const latexImageRegex = /\\includegraphics(?:\[[^\]]*\])?\{([^}]*https:\/\/res\.cloudinary\.com\/[^}]*)\}/g;
  
  // Collect all unique URLs
  const urlsFromGeneral = [...new Set(markdown.match(cloudinaryUrlRegex) || [])];
  const urlsFromLatex = [];
  let latexMatch;
  while ((latexMatch = latexImageRegex.exec(markdown)) !== null) {
    if (!urlsFromGeneral.includes(latexMatch[1])) {
      urlsFromLatex.push(latexMatch[1]);
    }
  }
  
  const imageUrls = [...urlsFromGeneral, ...urlsFromLatex];
  console.log(`[CLOUDINARY] Found ${imageUrls.length} images to optimize`);
  
  if (imageUrls.length === 0) {
    console.log('[CLOUDINARY] No Cloudinary URLs found in markdown');
    return markdown;
  }
  
  let optimizedMarkdown = markdown;
  
  imageUrls.forEach(originalUrl => {
    try {
      // Extract public ID from URL with improved parsing
      const publicIdMatch = originalUrl.match(/\/(?:v\d+\/)?([^\/\?]+?)(?:\.[^\/\?\.]*)?\??/);
      
      if (publicIdMatch) {
        const publicId = publicIdMatch[1];
        const optimizedUrl = getOptimizedUrl(publicId, format);
        
        // Replace with optimized URL using safe regex
        const escapedOriginal = originalUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        optimizedMarkdown = optimizedMarkdown.replace(
          new RegExp(escapedOriginal, 'g'),
          optimizedUrl
        );
        
        console.log(`[CLOUDINARY] ✓ Optimized: ${publicId}`);
      }
    } catch (error) {
      console.warn(`[CLOUDINARY] Failed to optimize URL: ${originalUrl}`, error.message);
    }
  });
  
  // Verify transformation
  const remainingUrls = optimizedMarkdown.match(cloudinaryUrlRegex);
  if (remainingUrls && remainingUrls.length > 0) {
    console.warn(`[CLOUDINARY] ${remainingUrls.length} URLs could not be optimized`);
  } else {
    console.log('[CLOUDINARY] ✓ All URLs successfully optimized');
  }
  
  return optimizedMarkdown;
}

/**
 * ADVANCED: Batch process images with concurrent optimization
 */
async function batchOptimizeImages(imageUrls, format = 'pdf', options = {}) {
  const { concurrency = 5, timeout = 10000 } = options;
  
  console.log(`[CLOUDINARY] Batch optimizing ${imageUrls.length} images`);
  
  const semaphore = Array(concurrency).fill(Promise.resolve());
  let index = 0;
  
  const processImage = async (url) => {
    try {
      const publicIdMatch = url.match(/\/(?:v\d+\/)?([^\/\?]+?)(?:\.[^\/\?\.]*)?\??/);
      if (!publicIdMatch) throw new Error('Invalid Cloudinary URL');
      
      const publicId = publicIdMatch[1];
      const optimizedUrl = getOptimizedUrl(publicId, format);
      
      // Pre-warm the cache
      await new Promise((resolve, reject) => {
        const request = https.get(optimizedUrl, { timeout }, (response) => {
          response.resume(); // Drain the response
          resolve();
        });
        request.on('error', reject);
        request.on('timeout', () => reject(new Error('Timeout')));
      });
      
      return { original: url, optimized: optimizedUrl, success: true };
    } catch (error) {
      return { original: url, error: error.message, success: false };
    }
  };
  
  const results = await Promise.all(
    imageUrls.map(async (url) => {
      await semaphore[index % concurrency];
      semaphore[index % concurrency] = processImage(url);
      index++;
      return semaphore[(index - 1) % concurrency];
    })
  );
  
  const successful = results.filter(r => r.success).length;
  console.log(`[CLOUDINARY] Batch complete: ${successful}/${imageUrls.length} optimized`);
  
  return results;
}

/**
 * Memory-efficient image cache for repeated operations
 */
class ImageCache {
  constructor(maxSize = 50) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.hits = 0;
    this.misses = 0;
  }
  
  generateKey(url, format) {
    return crypto.createHash('md5').update(`${url}-${format}`).digest('hex');
  }
  
  get(url, format) {
    const key = this.generateKey(url, format);
    const item = this.cache.get(key);
    
    if (item) {
      this.hits++;
      // Move to end (LRU)
      this.cache.delete(key);
      this.cache.set(key, item);
      return item;
    }
    
    this.misses++;
    return null;
  }
  
  set(url, format, data) {
    const key = this.generateKey(url, format);
    
    // Remove oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      url,
      format
    });
  }
  
  clear() {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }
  
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: this.hits / (this.hits + this.misses) || 0
    };
  }
}

// Global cache instance
const imageCache = new ImageCache();

/**
 * Enhanced middleware with optimization
 */
const cloudImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/jpg'];
    cb(null, allowedTypes.includes(file.mimetype));
  }
});

/**
 * Express middleware with enhanced error handling
 */
const optimizedImageUpload = (req, res, next) => {
  console.log('[CLOUDINARY] Starting optimized upload');
  
  cloudImageUpload.single('file')(req, res, async (err) => {
    if (err) {
      console.error('[CLOUDINARY] Upload error:', err);
      return res.status(400).json({ 
        success: false, 
        error: err.message,
        code: 'UPLOAD_ERROR'
      });
    }
    
    if (!req.file) {
      console.error('[CLOUDINARY] No file found in request');
      return res.status(400).json({ 
        success: false, 
        error: 'No file uploaded',
        code: 'NO_FILE'
      });
    }

    try {
      const userId = req.user?.id || req.body.userId || 'anonymous';
      const projectId = req.body.projectId || 'default';
      const folder = `publishjockey/${userId}/${projectId}`;
      const public_id = `${Date.now()}-${req.file.originalname.replace(/\.[^/.]+$/, "")}`;
      
      const result = await uploadToCloudinary(req.file.buffer, {
        folder,
        public_id,
        tags: [userId, projectId, 'book-image', 'optimized']
      });
      
      req.cloudinaryResult = result;
      next();
      
    } catch (uploadError) {
      console.error('[CLOUDINARY] Upload failed:', uploadError);
      return res.status(500).json({ 
        success: false, 
        error: 'Cloud upload failed',
        details: uploadError.message,
        code: 'CLOUDINARY_ERROR'
      });
    }
  });
};

/**
 * Delete image from Cloudinary
 */
function deleteFromCloudinary(publicId) {
  return cloudinary.uploader.destroy(publicId);
}

/**
 * Get optimized image URL (legacy support)
 */
function getOptimizedImageUrl(publicId, options = {}) {
  return cloudinary.url(publicId, {
    quality: 'auto',
    fetch_format: 'auto',
    secure: true,
    ...options
  });
}

/**
 * Legacy support functions (backward compatibility)
 */
function getBookFormatImageUrl(publicId, format = 'epub', customOptions = {}) {
  console.warn('[DEPRECATED] getBookFormatImageUrl - use getOptimizedUrl instead');
  return getOptimizedUrl(publicId, format, customOptions);
}

function getResponsiveImageUrls(publicId, format = 'epub') {
  console.warn('[DEPRECATED] getResponsiveImageUrls - use getOptimizedUrl with custom options');
  const baseTransform = BOOK_TRANSFORMATIONS[format];
  
  return {
    small: cloudinary.url(publicId, { ...baseTransform, width: 400 }),
    medium: cloudinary.url(publicId, { ...baseTransform, width: 800 }),
    large: cloudinary.url(publicId, { ...baseTransform, width: 1200 }),
    original: cloudinary.url(publicId, baseTransform)
  };
}

module.exports = {
  // Core functions
  cloudinary,
  uploadToCloudinary,
  getOptimizedUrl,
  
  // Optimized functions
  streamImageToPDF,
  optimizeMarkdownForPDF,
  batchOptimizeImages,
  
  // Middleware
  optimizedImageUpload,
  cloudImageUpload: optimizedImageUpload, // Alias for backward compatibility
  
  // Utilities
  imageCache,
  
  // Constants
  BOOK_TRANSFORMATIONS,
  
  // Legacy support (backward compatibility)
  deleteFromCloudinary,
  getOptimizedImageUrl,
  getBookFormatImageUrl,
  getResponsiveImageUrls,
  cloudinaryUpload: cloudImageUpload,
  
  // Legacy support with deprecation warnings
  downloadImageForPDF: (url) => {
    console.warn('[DEPRECATED] downloadImageForPDF - use streamImageToPDF instead');
    return streamImageToPDF(url);
  },
  prepareMarkdownForPDF: (markdown, tempDir, options) => {
    console.warn('[DEPRECATED] prepareMarkdownForPDF - use optimizeMarkdownForPDF instead');
    return optimizeMarkdownForPDF(markdown, options?.format || 'pdf');
  }
}; 