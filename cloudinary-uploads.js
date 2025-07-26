/**
 * Cloudinary Upload Solution for Render
 * Replaces local filesystem uploads with persistent cloud storage
 * Enhanced with advanced transformations and optimization
 */

const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const streamifier = require('streamifier');
const fs = require('fs');
const path = require('path');

// Configure Cloudinary (set these environment variables in Render)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Validate Cloudinary configuration on startup
const config = cloudinary.config();
console.log('[CLOUDINARY] Configuration loaded:');
console.log('[CLOUDINARY] Cloud name:', config.cloud_name ? 'SET' : 'NOT SET');
console.log('[CLOUDINARY] API key:', config.api_key ? 'SET' : 'NOT SET');
console.log('[CLOUDINARY] API secret:', config.api_secret ? 'SET' : 'NOT SET');

if (!config.cloud_name || !config.api_key || !config.api_secret) {
  console.error('[CLOUDINARY ERROR] Missing required environment variables!');
  console.error('[CLOUDINARY ERROR] Required: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET');
  throw new Error('Cloudinary configuration incomplete');
}

/**
 * Advanced transformation presets for different book formats
 */
const BOOK_TRANSFORMATIONS = {
  pdf: {
    // High-resolution for print quality
    quality: 'auto:best',
    format: 'auto',
    dpr: '2.0',
    flags: 'immutable_cache'
  },
  epub: {
    // Web-optimized for e-readers
    quality: 'auto:good',
    format: 'auto',
    flags: 'progressive,immutable_cache'
  },
  docx: {
    // Balanced for document embedding
    quality: 'auto:good',
    format: 'auto',
    flags: 'immutable_cache'
  },
  thumbnail: {
    // Small previews
    width: 200,
    height: 200,
    crop: 'fill',
    quality: 'auto:good',
    format: 'auto'
  }
};

/**
 * Get optimized image URL with book format-specific transformations
 * @param {string} publicId - Cloudinary public ID
 * @param {string} format - Book format ('pdf', 'epub', 'docx')
 * @param {Object} customOptions - Additional transformation options
 * @returns {string} - Optimized image URL
 */
function getBookFormatImageUrl(publicId, format = 'epub', customOptions = {}) {
  const baseTransform = BOOK_TRANSFORMATIONS[format] || BOOK_TRANSFORMATIONS.epub;
  
  return cloudinary.url(publicId, {
    ...baseTransform,
    ...customOptions
  });
}

/**
 * Get responsive image URLs for different screen sizes
 * @param {string} publicId - Cloudinary public ID
 * @param {string} format - Book format
 * @returns {Object} - Object with different size URLs
 */
function getResponsiveImageUrls(publicId, format = 'epub') {
  const baseTransform = BOOK_TRANSFORMATIONS[format];
  
  return {
    small: cloudinary.url(publicId, { ...baseTransform, width: 400 }),
    medium: cloudinary.url(publicId, { ...baseTransform, width: 800 }),
    large: cloudinary.url(publicId, { ...baseTransform, width: 1200 }),
    original: cloudinary.url(publicId, baseTransform)
  };
}

/**
 * Upload image to Cloudinary with smart optimization
 * @param {Buffer} buffer - Image buffer
 * @param {Object} options - Upload options
 * @returns {Promise} - Cloudinary upload result with additional metadata
 */
function uploadToCloudinary(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    const uploadOptions = {
      resource_type: 'image',
      folder: options.folder || 'publishjockey',
      public_id: options.public_id,
      tags: options.tags || ['publishjockey'],
      transformation: options.transformation || null,
      // Enable automatic format selection and quality optimization
      quality: 'auto:good',
      fetch_format: 'auto',
      // Generate multiple formats for different use cases
      eager: [
        { ...BOOK_TRANSFORMATIONS.pdf, width: 800 },
        { ...BOOK_TRANSFORMATIONS.epub, width: 600 },
        { ...BOOK_TRANSFORMATIONS.thumbnail }
      ],
      eager_async: true,
      ...options.cloudinaryOptions
    };

    const uploadStream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) {
          console.error('Cloudinary upload error:', error);
          reject(error);
        } else {
          console.log('Cloudinary upload success:', result.public_id);
          
          // Add convenience URLs to the result
          const enhancedResult = {
            ...result,
            optimizedUrls: {
              pdf: getBookFormatImageUrl(result.public_id, 'pdf'),
              epub: getBookFormatImageUrl(result.public_id, 'epub'),
              docx: getBookFormatImageUrl(result.public_id, 'docx'),
              thumbnail: getBookFormatImageUrl(result.public_id, 'thumbnail')
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
 * Delete image from Cloudinary
 * @param {string} publicId - Cloudinary public ID
 * @returns {Promise} - Deletion result
 */
function deleteFromCloudinary(publicId) {
  return cloudinary.uploader.destroy(publicId);
}

/**
 * Get optimized image URL from Cloudinary
 * @param {string} publicId - Cloudinary public ID
 * @param {Object} options - Transformation options
 * @returns {string} - Optimized image URL
 */
function getOptimizedImageUrl(publicId, options = {}) {
  return cloudinary.url(publicId, {
    quality: 'auto',
    fetch_format: 'auto',
    ...options
  });
}

/**
 * Multer configuration for memory storage (no local files)
 */
const cloudinaryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { 
    fileSize: 20 * 1024 * 1024 // 20 MB limit
  },
  fileFilter: (req, file, cb) => {
    if ([
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/jpg'
    ].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported image type'), false);
    }
  }
});

/**
 * Express middleware for cloud image uploads
 * Usage: app.post('/upload', cloudImageUpload, async (req, res) => { ... })
 */
const cloudImageUpload = (req, res, next) => {
  console.log('[CLOUDINARY MIDDLEWARE] Starting image upload process');
  console.log('[CLOUDINARY MIDDLEWARE] Content-Type:', req.headers['content-type']);
  
  cloudinaryUpload.single('file')(req, res, async (err) => {
    if (err) {
      console.error('[CLOUDINARY MIDDLEWARE] Multer error:', err);
      return res.status(400).json({ success: false, error: err.message });
    }
    
    if (!req.file) {
      console.error('[CLOUDINARY MIDDLEWARE] No file found in request');
      console.log('[CLOUDINARY MIDDLEWARE] Request body keys:', Object.keys(req.body || {}));
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    console.log('[CLOUDINARY MIDDLEWARE] File received:', {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.buffer?.length
    });

    try {
      // Extract user/project info
      const userId = req.user?.id || req.body.userId || 'anonymous';
      const projectId = req.body.projectId || 'default';
      
      console.log('[CLOUDINARY MIDDLEWARE] Upload info:', { userId, projectId });
      
      // Create organized folder structure
      const folder = `publishjockey/${userId}/${projectId}`;
      const public_id = `${Date.now()}-${req.file.originalname.replace(/\.[^/.]+$/, "")}`;
      
      console.log('[CLOUDINARY MIDDLEWARE] Upload parameters:', { folder, public_id });
      
      // Upload to Cloudinary
      const result = await uploadToCloudinary(req.file.buffer, {
        folder: folder,
        public_id: public_id,
        tags: [userId, projectId, 'book-image']
      });
      
      console.log('[CLOUDINARY MIDDLEWARE] Upload successful:', result.public_id);
      
      // Attach result to request for further processing
      req.cloudinaryResult = result;
      next();
      
    } catch (uploadError) {
      console.error('[CLOUDINARY MIDDLEWARE] Upload failed:', uploadError);
      console.error('[CLOUDINARY MIDDLEWARE] Upload error stack:', uploadError.stack);
      return res.status(500).json({ 
        success: false, 
        error: 'Cloud upload failed',
        details: uploadError.message 
      });
    }
  });
};

/**
 * Download image from Cloudinary to temporary location for PDF generation
 * Enhanced with caching and optimization
 * @param {string} imageUrl - Cloudinary image URL
 * @param {string} tempDir - Temporary directory for download
 * @param {Object} options - Download options
 * @returns {Promise<string>} - Local temp file path
 */
async function downloadImageForPDF(imageUrl, tempDir, options = {}) {
  const https = require('https');
  const crypto = require('crypto');
  
  // Create cache key from URL
  const urlHash = crypto.createHash('md5').update(imageUrl).digest('hex');
  const extension = path.extname(imageUrl.split('?')[0]) || '.jpg';
  const filename = options.filename || `cached-${urlHash}${extension}`;
  const tempPath = path.join(tempDir, filename);
  
  // Check if file already exists (simple caching)
  if (fs.existsSync(tempPath)) {
    console.log(`Using cached image for PDF: ${tempPath}`);
    return tempPath;
  }
  
  // Ensure temp directory exists
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(tempPath);
    
    const request = https.get(imageUrl, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }
      
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log(`Downloaded image for PDF: ${tempPath}`);
        resolve(tempPath);
      });
    });
    
    request.on('error', (err) => {
      fs.unlink(tempPath, () => {}); // Delete partial file
      reject(err);
    });
    
    // Set timeout for large images
    request.setTimeout(30000, () => {
      request.destroy();
      fs.unlink(tempPath, () => {});
      reject(new Error('Download timeout'));
    });
  });
}

/**
 * Replace image URLs in markdown with temporary local paths for PDF generation
 * Enhanced with parallel downloads and format optimization
 * @param {string} markdown - Markdown content with Cloudinary URLs
 * @param {string} tempDir - Temporary directory
 * @param {Object} options - Processing options
 * @returns {Promise<string>} - Modified markdown with local paths
 */
async function prepareMarkdownForPDF(markdown, tempDir, options = {}) {
  // Find all Cloudinary image URLs in the markdown
  const cloudinaryUrlRegex = /https:\/\/res\.cloudinary\.com\/[^)\s]+/g;
  const imageUrls = [...new Set(markdown.match(cloudinaryUrlRegex) || [])]; // Remove duplicates
  
  console.log(`[CLOUDINARY] Found ${imageUrls.length} unique Cloudinary images to process for PDF`);
  
  if (imageUrls.length === 0) {
    return markdown;
  }
  
  let processedMarkdown = markdown;
  const downloadPromises = [];
  
  // Process images in parallel for better performance
  for (const imageUrl of imageUrls) {
    const promise = (async () => {
      try {
        // Optimize URL for PDF format if it's not already optimized
        let optimizedUrl = imageUrl;
        if (!imageUrl.includes('q_auto:best') && !imageUrl.includes('dpr_2.0')) {
          // Apply PDF-specific optimizations
          const urlParts = imageUrl.split('/upload/');
          if (urlParts.length === 2) {
            const baseUrl = urlParts[0] + '/upload/';
            const imagePath = urlParts[1];
            optimizedUrl = `${baseUrl}q_auto:best,f_auto,dpr_2.0/${imagePath}`;
            console.log(`[CLOUDINARY] Optimized URL for PDF: ${optimizedUrl}`);
          }
        }
        
        const localPath = await downloadImageForPDF(optimizedUrl, tempDir);
        const filename = path.basename(localPath);
        
        // Replace all instances of this URL in the markdown
        const regex = new RegExp(imageUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        processedMarkdown = processedMarkdown.replace(regex, filename);
        
        console.log(`[CLOUDINARY] ✓ Processed: ${imageUrl} -> ${filename}`);
        
        return { url: imageUrl, localPath, filename };
      } catch (downloadError) {
        console.error(`[CLOUDINARY] ✗ Failed to download: ${imageUrl}`, downloadError.message);
        return { url: imageUrl, error: downloadError };
      }
    })();
    
    downloadPromises.push(promise);
  }
  
  // Wait for all downloads to complete
  const results = await Promise.allSettled(downloadPromises);
  const successful = results.filter(r => r.status === 'fulfilled' && !r.value.error).length;
  const failed = results.length - successful;
  
  console.log(`[CLOUDINARY] PDF preparation complete: ${successful} successful, ${failed} failed`);
  
  if (failed > 0) {
    console.warn(`[CLOUDINARY] Some images failed to download. PDF generation may have missing images.`);
  }
  
  return processedMarkdown;
}

module.exports = {
  cloudinary,
  uploadToCloudinary,
  deleteFromCloudinary,
  getOptimizedImageUrl,
  getBookFormatImageUrl,
  getResponsiveImageUrls,
  cloudinaryUpload,
  cloudImageUpload,
  downloadImageForPDF,
  prepareMarkdownForPDF,
  BOOK_TRANSFORMATIONS
}; 