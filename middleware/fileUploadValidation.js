/**
 * File Upload Validation Middleware for Export Backend
 * Handles multer errors and provides user-friendly error messages
 */

const handleFileUploadError = (error, req, res, next) => {
  console.error('File upload error:', error);
  
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      error: 'File too large',
      message: 'File size exceeds the 15MB limit. Please choose a smaller file.',
      maxSize: '15MB'
    });
  }
  
  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      error: 'Unexpected file field',
      message: 'Invalid file upload request.'
    });
  }
  
  if (error.message && error.message.includes('Invalid file type')) {
    return res.status(400).json({
      error: 'Invalid file type',
      message: error.message,
      allowedTypes: ['JPEG', 'PNG', 'GIF', 'WebP']
    });
  }
  
  if (error.message && error.message.includes('Invalid file extension')) {
    return res.status(400).json({
      error: 'Invalid file extension',
      message: error.message,
      allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp']
    });
  }
  
  if (error.message && error.message.includes('Unsupported file type')) {
    return res.status(400).json({
      error: 'Unsupported file type',
      message: error.message
    });
  }
  
  // Generic file upload error
  return res.status(400).json({
    error: 'File upload failed',
    message: 'There was an error processing your file upload. Please try again.',
    details: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
};

/**
 * Validate file before processing
 */
const validateUploadedFile = (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({
      error: 'No file uploaded',
      message: 'Please select a file to upload.'
    });
  }
  
  // Additional validation if needed
  const maxSize = 15 * 1024 * 1024; // 15MB
  if (req.file.size > maxSize) {
    return res.status(400).json({
      error: 'File too large',
      message: 'File size exceeds the 15MB limit. Please choose a smaller file.',
      maxSize: '15MB',
      actualSize: `${(req.file.size / 1024 / 1024).toFixed(2)}MB`
    });
  }
  
  next();
};

module.exports = {
  handleFileUploadError,
  validateUploadedFile
};
