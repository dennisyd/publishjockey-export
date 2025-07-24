/**
 * MongoDB GridFS Upload Solution for Render
 * Stores images directly in MongoDB database using GridFS
 * Alternative to Cloudinary - no third-party dependencies
 */

const mongoose = require('mongoose');
const multer = require('multer');
const { GridFSBucket } = require('mongodb');
const { Readable } = require('stream');

// GridFS bucket for file storage
let gridFSBucket;

// Initialize GridFS when MongoDB connection is ready
mongoose.connection.on('connected', () => {
  gridFSBucket = new GridFSBucket(mongoose.connection.db, {
    bucketName: 'publishjockey_images'
  });
  console.log('✅ GridFS initialized for image storage');
});

/**
 * Upload image to MongoDB GridFS
 * @param {Buffer} buffer - Image buffer
 * @param {Object} metadata - File metadata
 * @returns {Promise} - GridFS upload result
 */
function uploadToGridFS(buffer, metadata = {}) {
  return new Promise((resolve, reject) => {
    if (!gridFSBucket) {
      return reject(new Error('GridFS not initialized'));
    }

    const filename = `${Date.now()}-${metadata.originalname || 'image'}`;
    const uploadStream = gridFSBucket.openUploadStream(filename, {
      metadata: {
        userId: metadata.userId,
        projectId: metadata.projectId,
        originalName: metadata.originalname,
        mimeType: metadata.mimetype,
        uploadedAt: new Date(),
        tags: metadata.tags || []
      }
    });

    // Create readable stream from buffer
    const readableStream = new Readable();
    readableStream.push(buffer);
    readableStream.push(null);

    readableStream.pipe(uploadStream);

    uploadStream.on('error', (error) => {
      console.error('GridFS upload error:', error);
      reject(error);
    });

    uploadStream.on('finish', () => {
      console.log('GridFS upload success:', filename);
      resolve({
        _id: uploadStream.id,
        filename: filename,
        url: `/api/images/${uploadStream.id}`,
        size: buffer.length
      });
    });
  });
}

/**
 * Delete image from GridFS
 * @param {string} fileId - GridFS file ID
 * @returns {Promise} - Deletion result
 */
async function deleteFromGridFS(fileId) {
  if (!gridFSBucket) {
    throw new Error('GridFS not initialized');
  }
  
  try {
    await gridFSBucket.delete(new mongoose.Types.ObjectId(fileId));
    console.log('GridFS file deleted:', fileId);
    return { success: true };
  } catch (error) {
    console.error('GridFS delete error:', error);
    throw error;
  }
}

/**
 * Get image stream from GridFS
 * @param {string} fileId - GridFS file ID
 * @returns {Promise<Object>} - File stream and metadata
 */
async function getImageFromGridFS(fileId) {
  if (!gridFSBucket) {
    throw new Error('GridFS not initialized');
  }

  try {
    const files = await gridFSBucket.find({ _id: new mongoose.Types.ObjectId(fileId) }).toArray();
    
    if (files.length === 0) {
      throw new Error('File not found');
    }

    const file = files[0];
    const downloadStream = gridFSBucket.openDownloadStream(new mongoose.Types.ObjectId(fileId));
    
    return {
      stream: downloadStream,
      filename: file.filename,
      contentType: file.metadata?.mimeType || 'image/jpeg',
      size: file.length
    };
  } catch (error) {
    console.error('GridFS download error:', error);
    throw error;
  }
}

/**
 * List images for a user/project
 * @param {string} userId - User ID
 * @param {string} projectId - Project ID
 * @returns {Promise<Array>} - List of images
 */
async function listUserImages(userId, projectId) {
  if (!gridFSBucket) {
    throw new Error('GridFS not initialized');
  }

  try {
    const files = await gridFSBucket.find({
      'metadata.userId': userId,
      'metadata.projectId': projectId
    }).toArray();

    return files.map(file => ({
      _id: file._id,
      filename: file.filename,
      originalName: file.metadata?.originalName,
      url: `/api/images/${file._id}`,
      size: file.length,
      uploadedAt: file.metadata?.uploadedAt
    }));
  } catch (error) {
    console.error('GridFS list error:', error);
    throw error;
  }
}

/**
 * Multer configuration for memory storage (GridFS)
 */
const gridFSUpload = multer({
  storage: multer.memoryStorage(),
  limits: { 
    fileSize: 10 * 1024 * 1024 // 10 MB limit (be mindful of MongoDB limits)
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
 * Express middleware for MongoDB image uploads
 * Usage: app.post('/upload', mongoImageUpload, async (req, res) => { ... })
 */
const mongoImageUpload = (req, res, next) => {
  gridFSUpload.single('image')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
    
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    try {
      // Extract user/project info
      const userId = req.user?.id || req.body.userId || 'anonymous';
      const projectId = req.body.projectId || 'default';
      
      // Upload to GridFS
      const result = await uploadToGridFS(req.file.buffer, {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        userId: userId,
        projectId: projectId,
        tags: ['book-image']
      });
      
      // Attach result to request for further processing
      req.gridFSResult = result;
      next();
      
    } catch (uploadError) {
      console.error('MongoDB upload failed:', uploadError);
      return res.status(500).json({ 
        success: false, 
        error: 'Database upload failed',
        details: uploadError.message 
      });
    }
  });
};

/**
 * Download image from GridFS to temporary location for PDF generation
 * @param {string} imageUrl - Internal image URL (/api/images/id)
 * @param {string} tempDir - Temporary directory for download
 * @returns {Promise<string>} - Local temp file path
 */
async function downloadImageForPDF(imageUrl, tempDir) {
  const fs = require('fs');
  const path = require('path');
  
  return new Promise(async (resolve, reject) => {
    try {
      // Extract file ID from URL (/api/images/123456789)
      const fileId = imageUrl.split('/').pop();
      
      // Get image from GridFS
      const { stream, filename, contentType } = await getImageFromGridFS(fileId);
      
      // Create temporary file
      const tempFilename = `temp-${Date.now()}-${filename}`;
      const tempPath = path.join(tempDir, tempFilename);
      const writeStream = fs.createWriteStream(tempPath);
      
      stream.pipe(writeStream);
      
      writeStream.on('finish', () => {
        console.log(`Downloaded image for PDF: ${tempPath}`);
        resolve(tempPath);
      });
      
      writeStream.on('error', (err) => {
        fs.unlink(tempPath, () => {}); // Cleanup on error
        reject(err);
      });
      
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Replace image URLs in markdown with temporary local paths for PDF generation
 * @param {string} markdown - Markdown content with /api/images/ URLs
 * @param {string} tempDir - Temporary directory
 * @returns {Promise<string>} - Modified markdown with local paths
 */
async function prepareMarkdownForPDF(markdown, tempDir) {
  // Find all internal image URLs in the markdown
  const imageUrlRegex = /\/api\/images\/[a-f0-9]{24}/g;
  const imageUrls = markdown.match(imageUrlRegex) || [];
  
  console.log(`Found ${imageUrls.length} database images to download for PDF`);
  
  let processedMarkdown = markdown;
  
  // Download each image and replace URL with local path
  for (const imageUrl of imageUrls) {
    try {
      const localPath = await downloadImageForPDF(imageUrl, tempDir);
      processedMarkdown = processedMarkdown.replace(imageUrl, localPath);
      console.log(`Replaced ${imageUrl} with ${localPath}`);
    } catch (downloadError) {
      console.error(`Failed to download image ${imageUrl}:`, downloadError);
      // Keep original URL as fallback
    }
  }
  
  return processedMarkdown;
}

/**
 * Get storage statistics
 * @returns {Promise<Object>} - Storage usage statistics
 */
async function getStorageStats() {
  if (!gridFSBucket) {
    throw new Error('GridFS not initialized');
  }

  try {
    const files = await gridFSBucket.find({}).toArray();
    const totalFiles = files.length;
    const totalSize = files.reduce((sum, file) => sum + file.length, 0);
    
    return {
      totalFiles,
      totalSize,
      totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
      files: files.map(f => ({
        _id: f._id,
        filename: f.filename,
        size: f.length,
        uploadedAt: f.uploadDate
      }))
    };
  } catch (error) {
    console.error('Error getting storage stats:', error);
    throw error;
  }
}

module.exports = {
  uploadToGridFS,
  deleteFromGridFS,
  getImageFromGridFS,
  listUserImages,
  gridFSUpload,
  mongoImageUpload,
  downloadImageForPDF,
  prepareMarkdownForPDF,
  getStorageStats
}; 