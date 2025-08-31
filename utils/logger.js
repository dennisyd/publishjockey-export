const isDevelopment = process.env.NODE_ENV !== 'production';
const isTest = process.env.NODE_ENV === 'test';

/**
 * Secure logging utility for export-backend
 */
class Logger {
  static debug(...args) {
    if (isDevelopment && !isTest) {
      console.log('[DEBUG]', ...args);
    }
  }

  static info(...args) {
    if (isDevelopment || isTest) {
      console.log('[INFO]', ...args);
    } else {
      const sanitizedArgs = args.map(arg => this.sanitizeForProduction(arg));
      console.log('[INFO]', ...sanitizedArgs);
    }
  }

  static warn(...args) {
    console.warn('[WARN]', ...args);
  }

  static error(...args) {
    console.error('[ERROR]', ...args);
  }

  static security(event, details = {}) {
    const timestamp = new Date().toISOString();
    
    if (isDevelopment) {
      console.log(`[SECURITY] ${timestamp} - ${event}:`, details);
    } else {
      const sanitizedDetails = {
        userId: details.userId ? this.maskId(details.userId) : undefined,
        success: details.success,
        reason: details.reason
      };
      console.log(`[SECURITY] ${timestamp} - ${event}:`, sanitizedDetails);
    }
  }

  static sanitizeForProduction(data) {
    if (typeof data === 'string') {
      return data;
    }
    
    if (typeof data === 'object' && data !== null) {
      const sanitized = { ...data };
      const sensitiveFields = ['token', 'secret', 'key', 'authorization', 'email'];
      
      sensitiveFields.forEach(field => {
        if (sanitized[field]) {
          if (field === 'token') {
            sanitized[field] = this.maskToken(sanitized[field]);
          } else {
            sanitized[field] = '[REDACTED]';
          }
        }
      });
      
      return sanitized;
    }
    
    return data;
  }

  static maskToken(token) {
    if (!token || typeof token !== 'string') return '[REDACTED]';
    if (token.length < 10) return '[REDACTED]';
    return `${token.substring(0, 4)}...${token.substring(token.length - 4)}`;
  }

  static maskId(id) {
    if (!id || typeof id !== 'string') return '[REDACTED]';
    if (id.length < 8) return '[REDACTED]';
    return `${id.substring(0, 4)}...${id.substring(id.length - 4)}`;
  }
}

module.exports = Logger;
