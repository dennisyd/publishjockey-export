const rateLimit = require('express-rate-limit');

// General API rate limiting for export backend
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Lower limit for export backend (more resource intensive)
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: 15 * 60 // 15 minutes in seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
});

// Very strict rate limiting for export operations
const exportLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // Only 10 exports per 5 minutes (exports are resource intensive)
  message: {
    error: 'Too many export requests. Export operations are resource intensive, please wait before trying again.',
    retryAfter: 5 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false, // Count all export attempts
});

// Moderate rate limiting for file uploads to export backend
const uploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 15, // Limit uploads for export processing
  message: {
    error: 'Too many upload attempts, please try again later.',
    retryAfter: 10 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting for health checks and status endpoints
const healthCheckLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // Allow frequent health checks
  message: {
    error: 'Too many health check requests.',
    retryAfter: 1 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting for image uploads (Cloudinary)
const imageLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 30, // Allow more image uploads
  message: {
    error: 'Too many image upload attempts, please try again later.',
    retryAfter: 10 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Authentication rate limiting (for JWT verification)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Allow reasonable auth checks
  message: {
    error: 'Too many authentication attempts, please try again later.',
    retryAfter: 15 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Export rate limiting middleware
module.exports = {
  general: generalLimiter,
  export: exportLimiter,
  upload: uploadLimiter,
  healthCheck: healthCheckLimiter,
  image: imageLimiter,
  auth: authLimiter
}; 