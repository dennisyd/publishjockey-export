const { execFile } = require('child_process'); // Yancy Dennis
const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const os = require('os');
const { getTocTitle } = require('./translations');
// Custom image processing handled by functions in this file

// Use custom Pandoc version if available, fallback to system pandoc
// Handle Windows vs Linux defaults properly
const PANDOC_PATH = process.env.PANDOC_PATH || 
  (process.platform === 'win32' ? 'pandoc' : '/root/.cache/pandoc-3.6.4');

/**
 * ENHANCED: More robust Cloudinary image detection and processing
 */
async function processCloudinaryImages(markdown, tempDir) {
  console.log(`[CLOUDINARY] Starting enhanced image processing`);
  console.log(`[CLOUDINARY] Markdown length: ${markdown.length} characters`);
  
  // Debug: Show sample of markdown content
  console.log(`[CLOUDINARY] First 500 chars of markdown:`);
  console.log(markdown.substring(0, 500));
  
  // STEP 1: Enhanced URL detection with multiple strategies
  const cloudinaryUrls = extractAllCloudinaryUrls(markdown);
  
  if (cloudinaryUrls.length === 0) {
    console.log(`[CLOUDINARY] No Cloudinary URLs found`);
    // Debug: show what images we do find
    const allImages = markdown.match(/!\[([^\]]*)\]\(([^)]+)\)/g) || [];
    console.log(`[CLOUDINARY] Found ${allImages.length} total images:`);
    allImages.slice(0, 3).forEach(img => console.log(`  - ${img}`));
    
    // Also check for custom image syntax
    const customImages = markdown.match(/\{\{IMAGE:[^}]+\}\}/g) || [];
    console.log(`[CLOUDINARY] Found ${customImages.length} custom {{IMAGE:...}} patterns:`);
    customImages.slice(0, 3).forEach(img => console.log(`  - ${img}`));
    
    return {
      markdown: markdown,
      downloadedFiles: [],
      stats: { successful: 0, failed: 0, total: 0 }
    };
  }
  
  console.log(`[CLOUDINARY] Found ${cloudinaryUrls.length} unique Cloudinary URLs`);
  cloudinaryUrls.forEach((url, i) => console.log(`[CLOUDINARY] URL ${i + 1}: ${url}`));
  
  // STEP 2: Convert custom {{IMAGE:...}} syntax to standard markdown FIRST
  let processedMarkdown = convertCustomImageSyntax(markdown);
  
  // STEP 3: Download images with enhanced error handling
  const downloadResults = await downloadCloudinaryImagesRobust(cloudinaryUrls, tempDir);
  
  // STEP 4: Replace URLs in markdown with local paths
  processedMarkdown = replaceCloudinaryUrlsWithLocalPaths(processedMarkdown, downloadResults);
  
  // STEP 5: Final verification and cleanup
  const verification = verifyCloudinaryProcessing(processedMarkdown);
  
  const successful = downloadResults.filter(r => r.success).length;
  const failed = downloadResults.length - successful;
  
  console.log(`[CLOUDINARY] Processing complete: ${successful} successful, ${failed} failed`);
  console.log(`[CLOUDINARY] Verification: ${verification.remainingUrls.length} URLs still remain`);
  
  return {
    markdown: processedMarkdown,
    downloadedFiles: downloadResults.filter(r => r.success).map(r => r.localPath),
    stats: { successful, failed, total: downloadResults.length }
  };
}

/**
 * Extract ALL Cloudinary URLs from markdown using multiple strategies
 */
function extractAllCloudinaryUrls(markdown) {
  const urlsFound = new Set();
  
  // Strategy 1: Custom {{IMAGE:...}} syntax
  const customImagePattern = /\{\{IMAGE:(https:\/\/res\.cloudinary\.com\/[^|]+)/g;
  let match;
  while ((match = customImagePattern.exec(markdown)) !== null) {
    urlsFound.add(match[1]);
    console.log(`[CLOUDINARY] Found custom image: ${match[1]}`);
  }
  
  // Strategy 2: Standard markdown images
  const markdownPattern = /!\[([^\]]*)\]\((https:\/\/res\.cloudinary\.com\/[^)]+)\)/g;
  while ((match = markdownPattern.exec(markdown)) !== null) {
    urlsFound.add(match[2]);
    console.log(`[CLOUDINARY] Found markdown image: ${match[2]}`);
  }
  
  // Strategy 3: LaTeX includegraphics
  const latexPattern = /\\includegraphics(?:\[[^\]]*\])?\{(https:\/\/res\.cloudinary\.com\/[^}]+)\}/g;
  while ((match = latexPattern.exec(markdown)) !== null) {
    urlsFound.add(match[1]);
    console.log(`[CLOUDINARY] Found LaTeX image: ${match[1]}`);
  }
  
  // Strategy 4: Raw URLs (most permissive)
  const rawUrlPattern = /(https:\/\/res\.cloudinary\.com\/[^\s\[\](){}'"<>]+)/g;
  while ((match = rawUrlPattern.exec(markdown)) !== null) {
    const url = match[1].replace(/[.,;!?})\]]+$/, ''); // Clean trailing punctuation
    urlsFound.add(url);
    console.log(`[CLOUDINARY] Found raw URL: ${url}`);
  }
  
  return Array.from(urlsFound);
}

/**
 * Convert custom {{IMAGE:...}} syntax to standard markdown
 */
function convertCustomImageSyntax(markdown) {
  console.log(`[CLOUDINARY] Converting custom image syntax...`);
  
  const customImagePattern = /\{\{IMAGE:([^|]+)\|([^|]*)\|([^}]*)\}\}/g;
  let convertCount = 0;
  
  const converted = markdown.replace(customImagePattern, (match, url, alt, scale) => {
    convertCount++;
    console.log(`[CLOUDINARY] Converting image ${convertCount}: "${alt}" (scale: ${scale})`);
    console.log(`[CLOUDINARY] URL: ${url}`);
    
    const scaleValue = parseFloat(scale) || 1.0;
    // Don't use default captions - if alt is "Image" or empty, make it empty
    const cleanAlt = (alt && alt.trim() && alt.trim() !== 'Image') ? alt.trim() : '';
    // Escape LaTeX special characters in alt text to prevent LaTeX errors
    const escapedAlt = cleanAlt.replace(/[{}]/g, '\\$&'); // Escape { and } braces
    console.log(`[CLOUDINARY] Alt cleaned: "${alt}" -> "${cleanAlt}" -> "${escapedAlt}"`);
    return `![${escapedAlt}](${url})<!-- scale:${scaleValue} -->`;
  });
  
  console.log(`[CLOUDINARY] Converted ${convertCount} custom images to markdown`);
  return converted;
}

/**
 * Download Cloudinary images with robust error handling and retry logic
 */
async function downloadCloudinaryImagesRobust(urls, tempDir) {
  const results = [];
  
  // Ensure temp directory exists
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
    console.log(`[CLOUDINARY] Created temp directory: ${tempDir}`);
  }
  
  // Verify temp directory is writable
  try {
    fs.accessSync(tempDir, fs.constants.W_OK);
    console.log(`[CLOUDINARY] Temp directory is writable: ${tempDir}`);
  } catch (error) {
    console.error(`[CLOUDINARY] Temp directory not writable: ${error.message}`);
    throw new Error(`Cannot write to temp directory: ${tempDir}`);
  }
  
  // Process images in smaller batches to avoid overwhelming the server
  const batchSize = 3;
  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);
    console.log(`[CLOUDINARY] Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(urls.length/batchSize)}`);
    
    const batchPromises = batch.map(async (url, batchIndex) => {
      const globalIndex = i + batchIndex;
      
      // Add staggered delay to prevent rate limiting
      await new Promise(resolve => setTimeout(resolve, globalIndex * 300));
      
      try {
        const result = await downloadSingleCloudinaryImage(url, tempDir);
        console.log(`[CLOUDINARY] ✓ Downloaded: ${url} -> ${result.filename}`);
        return { 
          original: url, 
          localPath: result.localPath,
          filename: result.filename,
          success: true 
        };
      } catch (error) {
        console.error(`[CLOUDINARY] ✗ Failed: ${url} - ${error.message}`);
        return { 
          original: url, 
          error: error.message, 
          success: false 
        };
      }
    });
    
    const batchResults = await Promise.allSettled(batchPromises);
    batchResults.forEach(result => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        console.error(`[CLOUDINARY] Batch error:`, result.reason);
        results.push({ 
          original: 'unknown', 
          error: result.reason?.message || 'Unknown batch error', 
          success: false 
        });
      }
    });
    
    // Pause between batches
    if (i + batchSize < urls.length) {
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }
  
  return results;
}

/**
 * Download a single Cloudinary image with multiple fallback strategies
 */
async function downloadSingleCloudinaryImage(imageUrl, tempDir) {
   return new Promise(async (resolve, reject) => {
    console.log(`[CLOUDINARY] Processing: ${imageUrl}`);
    
    // Validate URL
    if (!imageUrl.includes('res.cloudinary.com')) {
      reject(new Error(`Not a valid Cloudinary URL: ${imageUrl}`));
      return;
    }
    
    // Generate consistent filename
    const urlForHash = imageUrl.split('?')[0];
    const hash = crypto.createHash('md5').update(urlForHash).digest('hex');
    const originalExt = path.extname(urlForHash) || '.jpg';
    const filename = `img_${hash}${originalExt}`;
    const filepath = path.join(tempDir, filename);
    
    console.log(`[CLOUDINARY] Target file: ${filename}`);
    
    // Check cache first
    if (fs.existsSync(filepath)) {
      console.log(`[CLOUDINARY] ✓ Using cached: ${filename}`);
      return resolve({ localPath: filepath, filename });
    }
    
    // Multiple download strategies
    const strategies = [
      { url: imageUrl, name: 'Original URL' },
      { url: imageUrl.split('?')[0], name: 'Clean URL (no params)' }
    ];
    
    // Add simplified transform strategy for complex Cloudinary URLs
    if (imageUrl.includes('/upload/')) {
      strategies.push({ 
        url: imageUrl.replace(/\/upload\/[^\/]*\//, '/upload/'), 
        name: 'Simplified transform' 
      });
    }
    
    // If HTTP, try HTTPS
    if (imageUrl.startsWith('http://')) {
      strategies.push({ 
        url: imageUrl.replace('http://', 'https://'),
        name: 'HTTPS version'
      });
    }
    
    console.log(`[CLOUDINARY] Will try ${strategies.length} download strategies`);
    
    let lastError;
    
    for (const strategy of strategies) {
      try {
        console.log(`[CLOUDINARY] ${strategy.name}: ${strategy.url}`);
        
        await downloadWithStrategy(strategy.url, filepath);
        
        console.log(`[CLOUDINARY] ✓ Downloaded using ${strategy.name}: ${filename}`);
        return resolve({ 
          localPath: filepath, 
          filename,
          strategy: strategy.name 
        });
        
      } catch (error) {
        console.log(`[CLOUDINARY] ${strategy.name} failed: ${error.message}`);
        lastError = error;
      }
    }
    
    reject(new Error(`All download strategies failed. Last error: ${lastError?.message}`));
  });
}

/**
 * Actual download implementation with timeout and validation
 */
function downloadWithStrategy(url, filepath) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      timeout: 45000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PDF-Generator/1.0)',
        'Accept': 'image/*',
        'Accept-Encoding': 'gzip, deflate'
      }
    }, (response) => {
      
      console.log(`[CLOUDINARY] Response status: ${response.statusCode}`);
      console.log(`[CLOUDINARY] Content-Type: ${response.headers['content-type']}`);
          
          // Handle redirects
          if (response.statusCode === 301 || response.statusCode === 302) {
            const redirectUrl = response.headers.location;
        console.log(`[CLOUDINARY] Following redirect to: ${redirectUrl}`);
        return downloadWithStrategy(redirectUrl, filepath)
          .then(resolve)
          .catch(reject);
          }
          
          if (response.statusCode !== 200) {
        return reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          }
          
      // Validate content type
          const contentType = response.headers['content-type'] || '';
          if (!contentType.startsWith('image/')) {
        console.warn(`[CLOUDINARY] Warning: Unexpected content-type: ${contentType}`);
          }
          
          const chunks = [];
          let totalSize = 0;
          
          response.on('data', chunk => {
            chunks.push(chunk);
            totalSize += chunk.length;
            
        // Prevent huge downloads
            if (totalSize > 50 * 1024 * 1024) { // 50MB limit
              request.destroy();
          return reject(new Error('Image too large (>50MB)'));
            }
          });
          
          response.on('end', () => {
            try {
              const buffer = Buffer.concat(chunks);
              
              if (buffer.length === 0) {
            return reject(new Error('Empty response'));
          }
          
          // Basic image validation
          const isValidImage = validateImageBuffer(buffer);
              if (!isValidImage) {
            console.warn(`[CLOUDINARY] Warning: Response may not be valid image data`);
              }
              
              fs.writeFileSync(filepath, buffer);
          console.log(`[CLOUDINARY] ✓ Saved: ${path.basename(filepath)} (${buffer.length} bytes)`);
          resolve();
          
            } catch (error) {
          reject(new Error(`Failed to save: ${error.message}`));
        }
      });
      
      response.on('error', reject);
    });
    
    request.on('error', reject);
    request.on('timeout', () => {
          request.destroy();
      reject(new Error('Download timeout'));
        });
      });
}

/**
 * Validate image buffer contains actual image data
 */
function validateImageBuffer(buffer) {
  if (buffer.length < 4) return false;
  
  const header = buffer.slice(0, 4);
  return (
    (header[0] === 0xFF && header[1] === 0xD8) || // JPEG
    (header[0] === 0x89 && header[1] === 0x50) || // PNG
    (header[0] === 0x47 && header[1] === 0x49) || // GIF
    (header[0] === 0x42 && header[1] === 0x4D) || // BMP
    (header[0] === 0x52 && header[1] === 0x49)    // WEBP
  );
}

/**
 * Replace Cloudinary URLs with local paths in all contexts
 */
/**
 * Replace Cloudinary URLs with local paths in all contexts
 * FIXED: Properly handle Windows file paths for LaTeX
 */
function replaceCloudinaryUrlsWithLocalPaths(markdown, downloadResults) {
  let processedMarkdown = markdown;
  
  downloadResults.forEach(result => {
    if (result.success) {
      const urlToReplace = result.original;
      let localPath = result.localPath;
      
      // CRITICAL FIX: Convert Windows paths to LaTeX-compatible forward slashes
      // LaTeX doesn't understand backslashes in file paths on Windows
      localPath = localPath.replaceAll('\\', '/');
      
      console.log(`[CLOUDINARY] Replacing: ${urlToReplace} -> ${localPath}`);
      
      // Create escaped regex pattern
      const escapedUrl = urlToReplace.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      
      let totalReplacements = 0;
      
      // Replace markdown with scale
      const scalePattern = new RegExp(`!\\[([^\\]]*)\\]\\(${escapedUrl}\\)<!-- scale:([0-9.]+) -->`, 'g');
      processedMarkdown = processedMarkdown.replace(scalePattern, (match, alt, scale) => {
        totalReplacements++;
        const scaleValue = parseFloat(scale) || 0.5;
        // Clean caption: remove any unwanted prefixes, keep only the actual description
        let cleanCaption = '';
        if (alt && alt.trim()) {
          cleanCaption = alt.trim();
        }
        console.log(`[CLOUDINARY] Alt text: "${alt}" -> Clean caption: "${cleanCaption}"`);
        
        const result = cleanCaption
          ? `\\begin{figure}[ht]\n  \\centering\n  \\includegraphics[width=${scaleValue}\\textwidth]{${localPath}}\n  \\caption{${cleanCaption}}\n\\end{figure}`
          : `\\begin{center}\n\\includegraphics[width=${scaleValue}\\textwidth]{${localPath}}\n\\end{center}`;
        console.log(`[CLOUDINARY] ✓ Converted markdown with scale to LaTeX figure: ${result.substring(0, 100)}...`);
        return result;
      });
      
      // Replace standard markdown (no scale) — apply default scale 0.5
      const markdownPattern = new RegExp(`!\\[([^\\]]*)\\]\\(${escapedUrl}\\)`, 'g');
      processedMarkdown = processedMarkdown.replace(markdownPattern, (match, alt) => {
        totalReplacements++;
        // Clean caption: remove any unwanted prefixes, keep only the actual description
        let cleanCaption = '';
        if (alt && alt.trim()) {
          cleanCaption = alt.trim();
        }
        console.log(`[CLOUDINARY] Alt text: "${alt}" -> Clean caption: "${cleanCaption}"`);
        
        const result = cleanCaption
          ? `\\begin{figure}[ht]\n  \\centering\n  \\includegraphics[width=0.5\\textwidth]{${localPath}}\n  \\caption{${cleanCaption}}\n\\end{figure}`
          : `\\includegraphics[width=0.5\\textwidth]{${localPath}}`;
        console.log(`[CLOUDINARY] ✓ Converted standard markdown to LaTeX figure: ${result.substring(0, 100)}...`);
        return result;
      });
      
      // Replace LaTeX includegraphics - check if width already exists
      const latexPattern = new RegExp(`\\\\includegraphics(?:\\[([^\\]]*)\\])?\\{${escapedUrl}\\}`, 'g');
      processedMarkdown = processedMarkdown.replace(latexPattern, (match, existingParams) => {
        totalReplacements++;
        // If already has width parameter, preserve it; otherwise add default
        if (existingParams && existingParams.includes('width=')) {
          return `\\includegraphics[${existingParams}]{${localPath}}`;
        } else {
          return `\\includegraphics[width=0.5\\textwidth]{${localPath}}`;
        }
      });
      
      // Replace raw URLs
      let safetyCounter = 0;
      while (processedMarkdown.includes(urlToReplace) && safetyCounter < 20) {
        processedMarkdown = processedMarkdown.replace(urlToReplace, localPath);
        totalReplacements++;
        safetyCounter++;
      }
      
      console.log(`[CLOUDINARY] ✓ Made ${totalReplacements} replacements for ${urlToReplace}`);
      
    } else {
      // Replace failed downloads with error text
      processedMarkdown = replaceFailedDownload(processedMarkdown, result);
    }
  });
  
  return processedMarkdown;
}

/**
 * Enhanced image path resolution with better error handling
 * FIXED: Properly handle Windows file paths for LaTeX
 */
function resolveImagePaths(markdown, basePath) {
  console.log(`[IMAGE RESOLUTION] Starting resolution from: ${basePath}`);
  
  // Only process remaining markdown images (not LaTeX includegraphics)
  console.log(`[IMAGE RESOLUTION] Processing markdown, length: ${markdown.length}`);
  console.log(`[IMAGE RESOLUTION] Looking for markdown image patterns...`);
  
  return markdown.replace(/!\[([^\]]*)\]\(([^)]+)\)(<!-- scale:([0-9.]+) -->)?/g, (match, alt, imagePath, scaleComment, scale) => {
    console.log(`[IMAGE RESOLUTION] Found markdown image: ${match}`);
    console.log(`[IMAGE RESOLUTION] Alt: "${alt}", Path: "${imagePath}", Scale: "${scale}"`);
    
    // Skip URLs (should already be processed) - but remove scale comments
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      console.log(`[IMAGE RESOLUTION] Skipping URL: ${imagePath}`);
      // Return the match but without scale comments (both regular and HTML entities)
      return match.replace(/<!-- scale:[^>]*-->/g, '').replace(/&lt;!-- scale:[^&]*--&gt;/g, '');
    }
    
    const scaleValue = scale ? parseFloat(scale) : 0.5;
    
    // Skip if it looks like a processed filename (img_hash.jpg) - check full path or basename
    if (imagePath.match(/img_[a-f0-9]+\.(jpg|png|gif|webp)$/)) {
      console.log(`[IMAGE RESOLUTION] Skipping processed image: ${imagePath}`);
      // Convert to forward slashes for LaTeX
      const latexPath = imagePath.replaceAll('\\', '/');
      // Clean caption: remove "Figure X:" prefix if present, keep only the actual description
      let cleanCaption = '';
      if (alt && alt.trim()) {
        cleanCaption = alt.trim().replace(/^Figure\s*\d*\s*[:.]?\s*/i, '').trim();
      }
      
      const result = cleanCaption
        ? `\\begin{figure}[ht]\n  \\centering\n  \\includegraphics[width=${scaleValue}\\textwidth]{${latexPath}}\n  \\caption{${cleanCaption}}\n\\end{figure}`
        : `\\includegraphics[width=${scaleValue}\\textwidth]{${latexPath}}`;
      console.log(`[IMAGE RESOLUTION] ✓ Converted to LaTeX figure: ${result.substring(0, 100)}...`);
      return result;
    }
    
    // Skip if already absolute
    if (path.isAbsolute(imagePath)) {
      if (fs.existsSync(imagePath)) {
        // Convert to forward slashes for LaTeX
        const latexPath = imagePath.replaceAll('\\', '/');
        // Clean caption: remove any unwanted prefixes, keep only the actual description
        let cleanCaption = '';
        if (alt && alt.trim()) {
          cleanCaption = alt.trim();
        }
        console.log(`[CLOUDINARY] Alt text: "${alt}" -> Clean caption: "${cleanCaption}"`);
        
        return cleanCaption
          ? `\\begin{figure}[ht]\n  \\centering\n  \\includegraphics[width=${scaleValue}\\textwidth]{${latexPath}}\n  \\caption{${cleanCaption}}\n\\end{figure}`
          : `\\includegraphics[width=${scaleValue}\\textwidth]{${latexPath}}`;
      } else {
        console.warn(`[IMAGE RESOLUTION] Absolute path not found: ${imagePath}`);
        return `\\textit{[Image not found: ${path.basename(imagePath)}]}`;
      }
    }
    
    // Search locations
    const searchPaths = [
      path.resolve(basePath, imagePath),
      path.resolve(process.cwd(), imagePath),
      path.resolve(process.cwd(), path.basename(imagePath)),
      path.resolve(basePath, path.basename(imagePath))
    ];
    
    for (const searchPath of searchPaths) {
      if (fs.existsSync(searchPath)) {
        console.log(`[IMAGE RESOLUTION] ✓ Found: ${imagePath} -> ${searchPath}`);
        // Convert to forward slashes for LaTeX
        const latexPath = searchPath.replaceAll('\\', '/');
        // Clean caption: remove any unwanted prefixes, keep only the actual description
        let cleanCaption = '';
        if (alt && alt.trim()) {
          cleanCaption = alt.trim();
        }
        console.log(`[CLOUDINARY] Alt text: "${alt}" -> Clean caption: "${cleanCaption}"`);
        
        return cleanCaption
          ? `\\begin{figure}[ht]\n  \\centering\n  \\includegraphics[width=${scaleValue}\\textwidth]{${latexPath}}\n  \\caption{${cleanCaption}}\n\\end{figure}`
          : `\\includegraphics[width=${scaleValue}\\textwidth]{${latexPath}}`;
      }
    }
    
    console.warn(`[IMAGE RESOLUTION] ✗ Not found: ${imagePath}`);
    return `\\textit{[Image not found: ${path.basename(imagePath)}]}`;
  });
}

/**
 * Replace failed downloads with LaTeX error text
 */
function replaceFailedDownload(markdown, result) {
       const urlToReplace = result.original;
       const escapedUrl = urlToReplace.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const errorText = `\\textit{[Image download failed: ${result.error || 'unknown error'}]}`;
  
  console.log(`[CLOUDINARY] Replacing failed download: ${urlToReplace}`);
  
  // Replace in all possible contexts
  const patterns = [
    new RegExp(`!\\[([^\\]]*)\\]\\(${escapedUrl}\\)(?:<!-- scale:[0-9.]+ -->)?`, 'g'),
          new RegExp(`\\\\includegraphics(?:\\[[^\\]]*\\])?\\{${escapedUrl}\\}`, 'g'),
    new RegExp(escapedUrl, 'g')
  ];
  
  patterns.forEach(pattern => {
    markdown = markdown.replace(pattern, errorText);
  });
  
  return markdown;
}

/**
 * Verify that Cloudinary processing was successful
 */
function verifyCloudinaryProcessing(markdown) {
  const remainingUrls = [];
  
  // Check for any remaining Cloudinary URLs
  const patterns = [
    /https:\/\/res\.cloudinary\.com\/[^\s\[\](){}'"<>]+/g,
    /res\.cloudinary\.com\/[^\s\[\](){}'"<>]+/g
  ];
  
  patterns.forEach(pattern => {
    const matches = markdown.match(pattern);
    if (matches) {
      remainingUrls.push(...matches);
    }
  });
  
  if (remainingUrls.length > 0) {
    console.warn(`[CLOUDINARY] WARNING: ${remainingUrls.length} URLs still remain:`);
    remainingUrls.forEach(url => console.warn(`  - ${url}`));
      } else {
    console.log(`[CLOUDINARY] ✓ All Cloudinary URLs successfully processed`);
  }
  
  return { remainingUrls };
}

// Page Size Mappings
const pageSizes = {
  "5x8": { width: "5in", height: "8in" },
  "5.06x7.81": { width: "5.06in", height: "7.81in" },
  "5.25x8": { width: "5.25in", height: "8in" },
  "5.5x8.5": { width: "5.5in", height: "8.5in" },
  "6x9": { width: "6in", height: "9in" },
  "6.14x9.21": { width: "6.14in", height: "9.21in" },
  "6.69x9.61": { width: "6.69in", height: "9.61in" },
  "7x10": { width: "7in", height: "10in" },
  "7.44x9.69": { width: "7.44in", height: "9.69in" },
  "7.5x9.25": { width: "7.5in", height: "9.25in" },
  "8x10": { width: "8in", height: "10in" },
  "8.25x11": { width: "8.25in", height: "11in" },
  "8.5x11": { width: "8.5in", height: "11in" }
};

// Calculate margins
function getDynamicMargins(pageSizeKey, pageCount, includeBleed = false, hasPageNumbers = true) {
  let inside;
  if (pageCount <= 150) inside = 0.375;
  else if (pageCount <= 300) inside = 0.5;
  else if (pageCount <= 500) inside = 0.625;
  else if (pageCount <= 700) inside = 0.75;
  else inside = 0.875;

  let outside = includeBleed ? 0.375 : 0.25;
  let top = outside;
  let bottom = outside;

  switch (pageSizeKey) {
    case "5x8":
    case "5.06x7.81":
    case "5.25x8":
    case "5.5x8.5":
      outside = Math.max(outside, 0.425);
      top = Math.max(top, 0.375);
      bottom = Math.max(bottom, 0.375);
      break;
    case "6x9":
    case "6.14x9.21":
      outside = Math.max(outside, 0.425);
      top = Math.max(top, 0.5);
      bottom = Math.max(bottom, 0.5);
      break;
    case "6.69x9.61":
    case "7x10":
    case "7.44x9.69":
    case "7.5x9.25":
      outside = Math.max(outside, 0.425);
      top = Math.max(top, 0.5);
      bottom = Math.max(bottom, 0.5);
      break;
    case "8x10":
    case "8.25x11":
    case "8.5x11":
      outside = Math.max(outside, 0.525);
      top = Math.max(top, 0.5);
      bottom = Math.max(bottom, 0.5);
      break;
    default:
      outside = Math.max(outside, 0.425);
  }

  if (hasPageNumbers) {
    // Amazon KDP requires adequate space for page numbers to prevent cutoff
    // Use proportional margins based on book size for better spacing balance
    let pageNumberMargin;
    switch (pageSizeKey) {
      case "5x8":
      case "5.06x7.81":
      case "5.25x8":
      case "5.5x8.5":
        // Smaller books need less additional margin
        pageNumberMargin = 0.375;
        break;
      case "6x9":
      case "6.14x9.21":
        // Standard size - balanced margin
        pageNumberMargin = 0.5;
        break;
      case "6.69x9.61":
      case "7x10":
      case "7.44x9.69":
      case "7.5x9.25":
        // Medium-large books
        pageNumberMargin = 0.5;
        break;
      case "8x10":
      case "8.25x11":
      case "8.5x11":
        // Larger books can accommodate slightly more margin
        pageNumberMargin = 0.55;
        break;
      default:
        pageNumberMargin = 0.5;
    }
    bottom += pageNumberMargin;
    console.log(`[PAGE NUMBERS] Added ${pageNumberMargin}" bottom margin for ${pageSizeKey}`);
  }

  outside += 0.3;

  console.log(`[KDP MARGINS] ${pageSizeKey}, ${pageCount} pages: inside=${inside}", outside=${outside}", top=${top}", bottom=${bottom}"`);

  return { inside, outside, top, bottom };
}

/**
 * Estimate page count
 */
function estimatePageCount(markdownText, pageSizeKey, includeToc = true) {
  const wordCount = markdownText.split(/\s+/).length;
  
  let wordsPerPage = 300;
  switch (pageSizeKey) {
    case "5x8":
    case "5.06x7.81":
    case "5.25x8":
      wordsPerPage = 250;
      break;
    case "5.5x8.5":
      wordsPerPage = 275;
      break;
    case "6x9":
    case "6.14x9.21":
      wordsPerPage = 300;
      break;
    case "6.69x9.61":
    case "7x10":
    case "7.44x9.69":
      wordsPerPage = 350;
      break;
    case "7.5x9.25":
    case "8x10":
    case "8.25x11":
    case "8.5x11":
      wordsPerPage = 400;
      break;
  }
  
  let pageCount = Math.ceil(wordCount / wordsPerPage);
  pageCount += 4; // Front matter
  
  if (includeToc) {
    pageCount += Math.ceil(pageCount / 15);
  }
  
  const imageCount = (markdownText.match(/!\[.*?\]\(.*?\)/g) || []).length;
  pageCount += imageCount;
  
  const chapterCount = (markdownText.match(/^# /gm) || []).length;
  pageCount += Math.floor(chapterCount / 2);
  
  pageCount = Math.max(pageCount, 24);
  
  console.log(`[PAGE ESTIMATE] ${pageCount} pages (${wordCount} words, ${pageSizeKey})`);
  return pageCount;
}

function parseCustomSize(sizeStr) {
  const parts = sizeStr.replace(/\s+/g, '').split('x');
  if (parts.length === 2) {
    const width = parts[0].endsWith('in') ? parts[0] : `${parts[0]}in`;
    const height = parts[1].endsWith('in') ? parts[1] : `${parts[1]}in`;
    return { width, height };
  }
  console.log('WARNING: Could not parse custom size, falling back to 6x9');
  return pageSizes["6x9"];
}

function generatePageGeometryCode(pageSizeKey, pageCount, hasPageNumbers = true) {
  const sizeKey = pageSizeKey.replace(/\s+/g, '');
  const size = pageSizes[sizeKey] || 
              (sizeKey.includes('x') ? parseCustomSize(sizeKey) : pageSizes["6x9"]);
  
  const margins = getDynamicMargins(sizeKey, pageCount, false, hasPageNumbers);
  const width = size.width.replace('in', '');
  const height = size.height.replace('in', '');
  const textWidth = parseFloat(width) - margins.inside - margins.outside;
  const textHeight = parseFloat(height) - margins.top - margins.bottom;
  // Amazon KDP requires adequate footskip to prevent page number cutoff
  // Use proportional footskip based on book size
  let footskip = '0.4in'; // Default for no page numbers
  if (hasPageNumbers) {
    switch (sizeKey) {
      case "5x8":
      case "5.06x7.81":
      case "5.25x8":
      case "5.5x8.5":
        footskip = '0.4in'; // Smaller books - tighter spacing
        break;
      case "6x9":
      case "6.14x9.21":
        footskip = '0.5in'; // Standard size - balanced spacing
        break;
      case "6.69x9.61":
      case "7x10":
      case "7.44x9.69":
      case "7.5x9.25":
        footskip = '0.5in'; // Medium-large books
        break;
      case "8x10":
      case "8.25x11":
      case "8.5x11":
        footskip = '0.55in'; // Larger books - more spacing
        break;
      default:
        footskip = '0.5in';
    }
  }

  return {
    size,
    margins,
    width,
    height,
    textWidth,
    textHeight,
    footskip,
    latexCode: `
% --- AMAZON KDP COMPLIANT PAGE SIZE AND MARGINS ---
\\geometry{
  paperwidth=${width}in,
  paperheight=${height}in,
  left=${margins.outside}in,
  right=${margins.outside}in,
  top=${margins.top}in,
  bottom=${margins.bottom}in,
  footskip=${footskip},
  bindingoffset=0pt
}

% --- Enhanced image handling for better PDF generation ---
\\usepackage{graphicx}
\\usepackage{float}
\\usepackage{adjustbox}

% Set default image width to respect text width
\\setkeys{Gin}{width=\\linewidth,height=\\textheight,keepaspectratio}

% Enhanced includegraphics that respects width parameters but prevents oversized images
\\usepackage{xstring}
\\let\\oldincludegraphics\\includegraphics
\\renewcommand{\\includegraphics}[2][]{%
  % Only apply auto-scaling if no width parameter is specified
  \\IfSubStr{#1}{width}{%
    % Width parameter exists, use it directly and respect user scaling
    \\oldincludegraphics[#1]{#2}%
  }{%
    % No width parameter, apply auto-scaling for safety
    \\adjustbox{max width=\\textwidth,max height=0.8\\textheight,center}{%
      \\oldincludegraphics[#1]{#2}%
    }%
  }%
}

% --- Enable Pandoc .center divs ---
\\usepackage{etoolbox}
\\makeatletter
\\def\\markdownRendererDivClasscenter#1{%
  \\begin{center}#1\\end{center}%
}
\\makeatother

% --- Enhanced URL and text handling ---
\\usepackage{microtype}
\\usepackage{url}
\\usepackage{xurl}
\\usepackage{hyphenat}
\\usepackage{seqsplit}
\\urlstyle{same}

% Better URL breaking - allows URLs to break at more characters
\\def\\UrlBreaks{\\do\\-\\do\\_\\do\\.\\do\\@\\do\\\\\\do\\/}
\\def\\UrlBigBreaks{\\do\\-\\do\\_\\do\\.\\do\\@\\do\\\\\\do\\/}

% Allow emergency stretching for URLs and long text
\\emergencystretch=3em
\\tolerance=2000

% --- Enhanced Justification with URL consideration ---
\\usepackage{ragged2e}
\\AtBeginDocument{\\justifying}

% --- Page numbers are handled by template fancyhdr configuration ---

% --- PDF dimensions ---
\\pdfpagewidth=${width}in
\\pdfpageheight=${height}in
\\special{papersize=${width}in,${height}in}

% --- Enhanced text flow for URLs and justification ---
\\tolerance=3000
\\emergencystretch=5em
\\hbadness=10000
\\vfuzz=30pt
\\hfuzz=30pt

% Additional penalties for better URL handling
\\hyphenpenalty=50
\\exhyphenpenalty=50
\\binoppenalty=700
\\relpenalty=500
\\clubpenalty=150
\\widowpenalty=150
\\setlength{\\rightskip}{0pt plus 5pt}
\\parfillskip=0pt plus 0.75\\textwidth
\\sloppy
\\setlength{\\parindent}{1em}
`
  };
}

// Helper functions
function getPandocVariables(options) {
  const vars = [];
  vars.push(`documentclass=${options.documentclass || (options.bindingType === 'hardcover' ? 'report' : 'book')}`);
  vars.push(`fontsize=${options.fontsize || '12pt'}`);
  if (options.includeBleed === true) {
    vars.push('bleed=true');
    vars.push('bleedmargin=0.125in');
  }
  
  // Language-specific configuration
  const language = options.language || 'en';
  const isRTL = language === 'ar' || language === 'he' || language === 'yi';
  const isCyrillic = language === 'ru';
  const isDevanagari = language === 'hi'; // Hindi uses Devanagari script
  
  // === MULTI-TEMPLATE SYSTEM ===
  // Select appropriate template based on script/language
  const indicLanguages = ['hi', 'ta', 'bn', 'gu', 'te', 'kn', 'ml', 'pa', 'or'];
  const isIndicScript = indicLanguages.includes(language);
  
  // Set template based on language type
  if (!options.template) {
    if (isIndicScript) {
      options.template = 'templates/custom-indic.tex';
      console.log(`[PDF EXPORT] Using Indic-optimized template for language: ${language}`);
      
      // Set the appropriate Indic font as main font if not already set
      if (!options.fontFamily) {
        const indicFontMap = {
          'hi': 'Noto Sans Devanagari',
          'ta': 'Noto Sans Tamil',
          'bn': 'Noto Sans Bengali',
          'gu': 'Noto Sans Gujarati',
          'te': 'Noto Sans Telugu',
          'kn': 'Noto Sans Kannada',
          'ml': 'Noto Sans Malayalam',
          'pa': 'Noto Sans Gurmukhi',
          'or': 'Noto Sans Oriya'
        };
        options.fontFamily = indicFontMap[language] || 'Noto Sans Tamil';
        console.log(`[PDF EXPORT] Set main font to: ${options.fontFamily}`);
      }
    } else {
      options.template = 'templates/custom.tex';
      console.log(`[PDF EXPORT] Using standard template for language: ${language}`);
    }
  }
  // === END MULTI-TEMPLATE SYSTEM ===
  
  // TOC title translation is now handled in bookAssemblerPdf.js
  console.log(`[TOC TRANSLATION] TOC title translation handled in bookAssemblerPdf.js for language "${language}"`);
  
  // Script-based languages that need ucharclasses font switching
  const scriptSwitchingLanguages = {
    'hi': { font: 'Noto Sans Devanagari', script: 'Devanagari', language: 'Hindi' },
    'ta': { font: 'Noto Sans Tamil', script: 'Tamil', language: 'Tamil' },
    'bn': { font: 'Noto Sans Bengali', script: 'Bengali', language: 'Bengali' },
    'gu': { font: 'Noto Sans Gujarati', script: 'Gujarati', language: 'Gujarati' },
    'te': { font: 'Noto Sans Telugu', script: 'Telugu', language: 'Telugu' },
    'kn': { font: 'Noto Sans Kannada', script: 'Kannada', language: 'Kannada' },
    'ml': { font: 'Noto Sans Malayalam', script: 'Malayalam', language: 'Malayalam' },
    'pa': { font: 'Noto Sans Gurmukhi', script: 'Gurmukhi', language: 'Punjabi' },
    'or': { font: 'Noto Sans Oriya', script: 'Oriya', language: 'Oriya' }
    // Note: Arabic (ar) uses its own template (arabic-enhanced.tex)
  };
  
  const requiresScriptSwitching = scriptSwitchingLanguages[language];
  
  console.log(`[DEBUG] Language: ${language}`);
  console.log(`[DEBUG] Script switching languages:`, Object.keys(scriptSwitchingLanguages));
  console.log(`[DEBUG] requiresScriptSwitching:`, requiresScriptSwitching);
  const isHebrew = language === 'he' || language === 'yi'; // Hebrew and Yiddish use Hebrew script
  
  // Debug language detection
  console.log(`[LANGUAGE DEBUG] Language detected: "${language}"`);
  console.log(`[LANGUAGE DEBUG] isRTL: ${isRTL}, isCyrillic: ${isCyrillic}, isDevanagari: ${isDevanagari}, isHebrew: ${isHebrew}`);
  
  // Platform-aware font selection with language support
  const exportPlatform = process.env.EXPORT_PLATFORM || (process.platform === 'win32' ? 'windows' : 'server');
  let defaultFont = exportPlatform === 'windows' ? 'Times New Roman' : 'Liberation Serif';
  // Debug platform detection
  console.log(`[FONT DEBUG] Platform detection:`);
  console.log(`[FONT DEBUG] - process.env.EXPORT_PLATFORM: ${process.env.EXPORT_PLATFORM}`);
  console.log(`[FONT DEBUG] - process.platform: ${process.platform}`);
  console.log(`[FONT DEBUG] - exportPlatform: ${exportPlatform}`);
  console.log(`[FONT DEBUG] - defaultFont: ${defaultFont}`);
  
  // For local testing, allow override via environment variable
  if (process.env.LOCAL_FONT_OVERRIDE) {
    defaultFont = process.env.LOCAL_FONT_OVERRIDE;
    console.log(`[FONT] Using local font override: ${defaultFont}`);
  }
  
  // Language-specific font selection
  if (language === 'en') {
    // For English, use platform-appropriate font
    // Don't override the already-calculated defaultFont for English
    console.log(`[FONT] English detected: using platform font ${defaultFont} (platform: ${exportPlatform})`);
  } else if (isCyrillic) {
    defaultFont = 'Times New Roman'; // Good Cyrillic support
  } else if (isHebrew) {
    defaultFont = 'Noto Sans Hebrew'; // Hebrew font
  } else if (language === 'ar') {
    // Arabic uses its own proven template (arabic-enhanced.tex) - Dennis: Modular templates
    defaultFont = 'Noto Sans Arabic';
    console.log(`[FONT] Arabic detected: using arabic-enhanced.tex template with ${defaultFont}`);
  } else if (language === 'pt' || language === 'pt-BR' || language === 'pt-PT' || 
             language === 'is' || language === 'hr') {
    defaultFont = 'Noto Sans'; // Portuguese, Icelandic, Croatian - use Noto Sans for better Latin script support
  } else if (requiresScriptSwitching) {
    // Script-based language that needs ucharclasses font switching (Hindi, Tamil, etc.)
    const scriptInfo = scriptSwitchingLanguages[language];
    defaultFont = scriptInfo.font;
    
    // Set up script-switching template variables
    vars.push('script-switching=true');
    vars.push(`script-font=${scriptInfo.font}`);
    vars.push(`script-name=${scriptInfo.script}`);
    vars.push(`script-language=${scriptInfo.language}`);
    vars.push('sansfont=Liberation Serif');
    
    console.log(`[FONT] Script-switching setup for ${language}: ${scriptInfo.font} + Liberation Serif fallback`);
  } else if (isDevanagari) {
    // Legacy Hindi support - keeping for backward compatibility
    defaultFont = 'Noto Sans Devanagari';
    vars.push('polyglossia=true');
    vars.push('lang=hi');
    vars.push('sansfont=Liberation Serif');
    vars.push('hyperref-unicode=true');
    console.log('[FONT] Legacy Hindi setup: Noto Sans Devanagari + Liberation Serif fallback');
  }
  
  // Ensure font names match exactly what's available on the system
  if (isRTL) {
    // Use exact font names from fc-list output
    if (language === 'ar') {
      defaultFont = 'Noto Sans Arabic';
    } else if (language === 'he' || language === 'yi') {
      defaultFont = 'Noto Sans Hebrew';
    }
  }
  
  // Try alternative font names if the primary ones don't work
  // These are the font family names that might work better with LaTeX
  if (isRTL && !options.fontFamily) {
    if (language === 'ar') {
      // Try alternative Arabic font names
      defaultFont = 'Noto Sans Arabic';
    } else if (language === 'he' || language === 'yi') {
      // Try alternative Hebrew font names
      defaultFont = 'Noto Sans Hebrew';
    }
  }
  
  // Debug: Log available fonts for RTL languages
  if (isRTL) {
    console.log(`[FONT DEBUG] RTL language detected: ${language}`);
    console.log(`[FONT DEBUG] Selected font: ${defaultFont}`);
    console.log(`[FONT DEBUG] Font from options: ${options.fontFamily}`);
  }
  
  console.log(`[FONT] Language: ${language}, RTL: ${isRTL}, Selected font: ${options.fontFamily || defaultFont}`);
  console.log(`[FONT] Font family from options: ${options.fontFamily}`);
  console.log(`[FONT] Default font: ${defaultFont}`);
  
  // For script-switching languages, don't set mainfont - let the template handle it
  if (!requiresScriptSwitching && !isDevanagari) {
    vars.push(`mainfont=${options.fontFamily || defaultFont}`);
  } else {
    console.log(`[FONT] Skipping mainfont for ${language} - template will handle script-based font switching`);
  }
  

  

  
  if (isRTL) {
    vars.push('latex-dir-rtl=true');
    // Add additional RTL-specific variables
    vars.push('dir=rtl');
  }
  
  // Add language variable for template conditionals (but skip babel for simplicity)
  if (language !== 'en') {
    // Note: TOC title translation is handled via YAML metadata, not babel
    // This avoids LaTeX package installation issues while still providing translated TOC titles
    console.log(`[LANGUAGE] Using language: ${language} (TOC title will be translated via metadata)`);
    vars.push(`lang=${language}`);
  }
  
  // Add TOC title variable to ensure proper translation
  // Note: toc-title is now set in YAML metadata block in bookAssemblerPdf.js
  // We don't need to set it here as a command line variable
  if (language !== 'en') {
    const tocTitle = getTocTitle(language);
    console.log(`[TOC TITLE] TOC title will be: "${tocTitle}" (set in YAML metadata)`);
    // vars.push(`toc-title=${tocTitle}`); // Commented out - using YAML metadata instead
  }
  
  vars.push('secstyle=\\Large\\bfseries\\filcenter');
  
  // Only disable page styling if page numbers are explicitly disabled
  if (options.includePageNumbers === false) {
    vars.push('pagestyle=empty');
    vars.push('plainfoot=');
    vars.push('emptyfoot=');
  } else {
    // Enable plain page style for centered page numbers (handled by template)
    vars.push('pagestyle=plain');
  }
  vars.push('disable-headers=true');
  if (options.includeToc !== false) {
    // Note: toc-title is now set in YAML metadata block, not as command line variable
    // vars.push(`toc-title=${getTocTitle(language)}`);
  }
  if (options.numberedHeadings !== true) {
    vars.push('numbersections=false');
    vars.push('secnumdepth=-10');
    vars.push('disable-all-numbering=true');
  }
  if (options.chapterLabelFormat === 'none' || options.useChapterPrefix === false) {
    vars.push('no-chapter-labels=true');
  } else if (options.chapterLabelFormat === 'text') {
    vars.push('chapter-name=Chapter');
    vars.push('chapter-name-format=text');
  }
  vars.push('no-blank-pages=true');
  vars.push('no-separator-pages=true');
  vars.push('frontmatter-continuous=true');
  vars.push('continuous-front-matter=true');
  vars.push('classoption=oneside');
  vars.push('classoption=openany');
  if (options.lineheight) {
    vars.push(`linestretch=${options.lineheight}`);
  }
  
  // Add explicit geometry variables to ensure correct paper size
  if (options.bookSize) {
    const geometry = generatePageGeometryCode(options.bookSize, options.pageCount || 100, options.includePageNumbers !== false);
    // Add complete geometry as Pandoc variables
    vars.push(`paperwidth=${geometry.width}in`);
    vars.push(`paperheight=${geometry.height}in`);
    vars.push(`leftmargin=${geometry.margins.outside}in`);
    vars.push(`rightmargin=${geometry.margins.outside}in`);
    vars.push(`topmargin=${geometry.margins.top}in`);
    vars.push(`bottommargin=${geometry.margins.bottom}in`);
    // Use proper footskip for Amazon KDP compliance (now dynamic based on book size)
    vars.push(`footskip=${geometry.footskip}`);
    console.log(`[PANDOC GEOMETRY] Added complete geometry for ${options.bookSize}: ${geometry.width}x${geometry.height} with margins L/R:${geometry.margins.outside}, T/B:${geometry.margins.top}/${geometry.margins.bottom}`);
  }
  
  return vars;
}

function getPandocMetadata(options) {
  const meta = [];
  if (options.title) meta.push(`title=${options.title}`);
  if (options.author) meta.push(`author=${options.author}`);
  if (options.subtitle) meta.push(`subtitle=${options.subtitle}`);
  if (options.isbn) meta.push(`isbn=${options.isbn}`);
  return meta;
}

function convertAlignmentDivsToLatex(markdown) {
  markdown = markdown.replace(
    /::: *\{\.center\}[\r\n]+([\s\S]*?)[\r\n]+:::/g,
    (match, content) => {
      // Improved guard: Do not wrap if content contains an image/figure (even across lines)
      if (/\\begin\{figure\}|\\includegraphics/.test(content)) {
        console.warn('[ALIGNMENT PATCH] Skipping center wrap for image/figure block.');
        return content.trim();
      }
      return `\\begin{center}\n${content.trim()}\n\\end{center}`;
    }
  );
  markdown = markdown.replace(
    /::: *\{\.right\}[\r\n]+([\s\S]*?)[\r\n]+:::/g,
    (match, content) => `\\begin{flushright}\n${content.trim()}\n\\end{flushright}`
  );
  return markdown;
}

/**
 * Enhanced chapter styling function with page breaks and conditional chapter labels
 */
function rewriteMarkdownWithStyledChapters(markdown, options = {}) {
  const lines = markdown.split('\n');
  let chapter = 1;
  const output = [];
  
  // Check if chapter labels should be added
  const shouldAddChapterLabels = options.chapterLabelFormat !== 'none' && options.useChapterPrefix !== false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const h1Match = /^# (?!#)(.*)/.exec(line);
    
    if (h1Match) {
      const headingText = h1Match[1].trim();
      
      // Add page break before each chapter (except the first one)
      if (chapter > 1) {
        if (output.length > 0 && output[output.length - 1].trim() !== '') {
          output.push('');
        }
        output.push('```{=latex}');
        output.push('\\clearpage');
        output.push('```');
        output.push('');
      } else {
        // For first chapter, just ensure proper spacing
        if (output.length > 0 && output[output.length - 1].trim() !== '') {
          output.push('');
        }
      }
      
      // Add entry to TOC using LaTeX commands (without creating visible heading)
      output.push('```{=latex}');
      if (shouldAddChapterLabels) {
        // Add "Chapter X: Heading" to TOC
        output.push(`\\addcontentsline{toc}{chapter}{Chapter ${chapter}: ${headingText}}`);
      } else {
        // Add just the heading text to TOC
        output.push(`\\addcontentsline{toc}{chapter}{${headingText}}`);
      }
      
      // Add visual styling (this is the only visible heading)
      output.push('\\begin{center}');
      
      if (shouldAddChapterLabels) {
        // With chapter labels: "Chapter X" + heading text
        output.push(`{\\fontsize{24pt}{28pt}\\selectfont\\textbf{Chapter ${chapter++}}}\\\\[0.5em]`);
        output.push(`{\\fontsize{16pt}{20pt}\\selectfont\\textit{${headingText}}}`);
      } else {
        // Without chapter labels: just the heading text, larger
        output.push(`{\\fontsize{28pt}{32pt}\\selectfont\\textbf{${headingText}}}`);
        chapter++; // Still increment for potential TOC numbering
      }
      
      output.push('\\end{center}');
      output.push('```');
      output.push('');
    } else {
      output.push(line);
    }
  }
  
  return output.join('\n').replace(/^\s*\n/, '').replace(/\n\s*$/, '') + '\n';
}

/**
 * Debug function to analyze what's happening with Cloudinary images
 */
async function debugCloudinaryProcessing(markdown, tempDir) {
  console.log('\n=== CLOUDINARY DEBUG SESSION ===');
  console.log(`Markdown length: ${markdown.length} characters`);
  console.log(`Temp directory: ${tempDir}`);
  
  // Step 1: Show raw markdown sample
  console.log('\n1. RAW MARKDOWN SAMPLE (first 1000 chars):');
  console.log(markdown.substring(0, 1000));
  
  // Step 2: Test each pattern individually
  console.log('\n2. PATTERN TESTING:');
  
  const patterns = [
    {
      name: 'Custom {{IMAGE:...}} syntax',
      pattern: /\{\{IMAGE:(https:\/\/res\.cloudinary\.com\/[^|]+)\|([^|]*)\|([^}]*)\}\}/g
    },
    {
      name: 'Standard markdown images',
      pattern: /!\[([^\]]*)\]\((https:\/\/res\.cloudinary\.com\/[^)]+)\)/g
    },
    {
      name: 'LaTeX includegraphics',
      pattern: /\\includegraphics(?:\[[^\]]*\])?\{(https:\/\/res\.cloudinary\.com\/[^}]+)\}/g
    },
    {
      name: 'Raw Cloudinary URLs',
      pattern: /(https:\/\/res\.cloudinary\.com\/[^\s\[\](){}'"<>]+)/g
    }
  ];
  
  const allUrls = new Set();
  
  patterns.forEach(({ name, pattern }) => {
    const matches = [...markdown.matchAll(pattern)];
    console.log(`${name}: ${matches.length} matches`);
    
    matches.forEach((match, i) => {
      console.log(`  ${i + 1}. ${match[0]}`);
      // Extract URL (different positions for different patterns)
      const url = match[1] || match[2];
      if (url && url.includes('cloudinary.com')) {
        allUrls.add(url);
      }
    });
  });
  
  console.log(`\nTotal unique URLs found: ${allUrls.size}`);
  console.log('=== DEBUG SESSION COMPLETE ===\n');
  
  return Array.from(allUrls);
}

/**
 * Convert underscore sequences to proper LaTeX form fields
 * Handles both inline form fields (between words) and end-of-line form fields
 */
function convertUnderscoresToFormFields(markdown) {
  console.log('[UNDERSCORE CONVERSION] Starting smart underscore conversion...');
  
  let processedMarkdown = markdown;
  let conversionCount = 0;
  
  // Pattern 1: Handle inline form fields (underscores between words)
  // Example: "Yancy ____ Dennis" -> "Yancy \underline{\hspace{0.4in}} Dennis"
  // FIXED: More restrictive - only match when there's meaningful text AFTER underscores on SAME LINE
  processedMarkdown = processedMarkdown.replace(/(\S+)\s+(_{3,9})\s+([^\s\-\n\r][^\n\r]{2,})/g, (match, beforeWord, underscores, afterWord) => {
    // Skip if this looks like an end-of-line pattern (colon before underscores)
    if (beforeWord.endsWith(':')) return match;
    
    const underscoreCount = underscores.length;
    // Calculate width: 3-5 underscores = 0.3in, 6-9 = 0.6in
    let width;
    if (underscoreCount <= 5) width = '0.3';
    else width = '0.6';
    
    console.log(`[UNDERSCORE CONVERSION] Inline: "${beforeWord} ${underscores} ${afterWord}" -> ${width}in width`);
    conversionCount++;
    return `${beforeWord} \\underline{\\hspace{${width}in}} ${afterWord}`;
  });
  
  // Pattern 2: Handle end-of-line form fields (colon followed by underscores)
  // Example: "Most unnecessary distraction today: _________________________"
  // FIXED: Use [^\n\r] to ensure we don't cross line boundaries
  processedMarkdown = processedMarkdown.replace(/^(\s*-?\s*)([^\n\r:]+):\s*(_{10,})\s*$/gm, (match, listMarker, label, underscores) => {
    const labelLength = label.trim().length;
    let fillWidth;
    
    // Calculate width based on label length to maintain visual balance
    if (labelLength < 15) fillWidth = '0.75';        // Short labels get longer lines
    else if (labelLength < 30) fillWidth = '0.6';    // Medium labels get medium lines  
    else if (labelLength < 45) fillWidth = '0.45';   // Long labels get shorter lines
    else fillWidth = '0.3';                          // Very long labels get shortest lines
    
                    console.log(`[UNDERSCORE CONVERSION] End-of-line: "${label}" (${labelLength} chars) -> ${fillWidth} line width`);
                conversionCount++;
                return `${listMarker}${label}: \\rule{${fillWidth}\\linewidth}{0.4pt}`;
  });
  
  // Pattern 3: Handle simple end-of-line underscores without colons
  // Example: "Name _________________________"
  // FIXED: Use [^\n\r] to ensure we don't cross line boundaries
  processedMarkdown = processedMarkdown.replace(/^(\s*-?\s*)([^\n\r]+?)\s+(_{10,})\s*$/gm, (match, listMarker, label, underscores) => {
    // Only process if it doesn't already have a colon (avoid double-processing)
    if (label.includes(':')) return match;
    
    const labelLength = label.trim().length;
    let fillWidth;
    
    if (labelLength < 10) fillWidth = '0.8';         // Very short labels
    else if (labelLength < 20) fillWidth = '0.65';   // Short labels
    else if (labelLength < 35) fillWidth = '0.5';    // Medium labels
    else fillWidth = '0.35';                         // Long labels
    
                    console.log(`[UNDERSCORE CONVERSION] Simple end-of-line: "${label}" (${labelLength} chars) -> ${fillWidth} line width`);
                conversionCount++;
                return `${listMarker}${label} \\rule{${fillWidth}\\linewidth}{0.4pt}`;
  });
  
  console.log(`[UNDERSCORE CONVERSION] Converted ${conversionCount} underscore sequences to form fields`);
  return processedMarkdown;
}

/**
 * MAIN EXPORT FUNCTION - Enhanced with better debugging and error handling
 */
async function exportPdf(assembledPath, outputPath, options = {}) {
  return new Promise(async (resolve, reject) => {
    console.log(`[PDF EXPORT] Starting enhanced export: ${assembledPath} -> ${outputPath}`);
    
    const tempDir = path.dirname(assembledPath);
    let downloadedFiles = [];
    
    try {
             // Read original markdown
       let markdown = fs.readFileSync(assembledPath, 'utf8');
       console.log(`[PDF EXPORT] Read ${markdown.length} characters from ${assembledPath}`);
       
      // Convert custom image blocks to markdown images (critical for figure/caption logic)
      markdown = convertCustomImageSyntax(markdown);
      
      // ENHANCED DEBUG: Run debug analysis
      console.log(`[PDF EXPORT] Running Cloudinary debug analysis...`);
      const debugUrls = await debugCloudinaryProcessing(markdown, tempDir);
      console.log(`[PDF EXPORT] Debug found ${debugUrls.length} potential Cloudinary URLs`);
      
      // STEP 1: Process Cloudinary images with enhanced function
       console.log(`[PDF EXPORT] Step 1: Processing Cloudinary images...`);
      const cloudinaryResult = await processCloudinaryImages(markdown, tempDir);
      markdown = cloudinaryResult.markdown;
      downloadedFiles = cloudinaryResult.downloadedFiles;
      
             console.log(`[PDF EXPORT] Cloudinary processing stats:`, cloudinaryResult.stats);
       
       if (cloudinaryResult.stats.total > 0) {
         console.log(`[PDF EXPORT] ✓ Processed ${cloudinaryResult.stats.successful} images successfully`);
         console.log(`[PDF EXPORT] ✗ Failed to process ${cloudinaryResult.stats.failed} images`);
        
        // Show downloaded files
        if (downloadedFiles.length > 0) {
          console.log(`[PDF EXPORT] Downloaded files:`);
          downloadedFiles.forEach(file => {
            if (fs.existsSync(file)) {
              const stats = fs.statSync(file);
              console.log(`  ✓ ${path.basename(file)} (${stats.size} bytes)`);
            } else {
              console.log(`  ✗ ${path.basename(file)} (missing)`);
            }
          });
        }
       } else {
         console.log(`[PDF EXPORT] ⚠️  No Cloudinary images found in markdown`);
       }
      
      // STEP 1.5: Custom images are now processed by resolveImagePaths and replaceCloudinaryUrlsWithLocalPaths
      // No need for replaceCustomImages since we have proper figure logic
      
      // STEP 2: Resolve any remaining image paths
      console.log(`[PDF EXPORT] Step 2: Resolving remaining image paths...`);
      const basePath = path.dirname(assembledPath);
      markdown = resolveImagePaths(markdown, basePath);
      
      // EARLY SANITIZE: Remove scale comments immediately after image processing
      console.log(`[PDF EXPORT] Step 2.5: Early sanitization of scale comments...`);
      const beforeEarlySanitize = markdown.length;
      markdown = markdown.replace(/<!--\s*scale:[^>]*-->/gi, '');
      markdown = markdown.replace(/&lt;!--\s*scale:[^&]*--&gt;/gi, '');
      markdown = markdown.replace(/<!-- scale:[^>]*-->/g, '');
      const afterEarlySanitize = markdown.length;
      console.log(`[PDF EXPORT] Early sanitization removed ${beforeEarlySanitize - afterEarlySanitize} characters`);
      
             // STEP 3: Apply proper chapter styling
       console.log(`[PDF EXPORT] Step 3: Applying chapter styling...`);
       markdown = rewriteMarkdownWithStyledChapters(markdown, options);
      
      // STEP 4: Convert alignment divs
      console.log(`[PDF EXPORT] Step 4: Converting alignment divs...`);
      markdown = convertAlignmentDivsToLatex(markdown);
      
      // STEP 4.1: Convert underscore sequences to proper form fields
      console.log(`[PDF EXPORT] Step 4.1: Converting underscore sequences to form fields...`);
      markdown = convertUnderscoresToFormFields(markdown);
      
             // STEP 4.5: RTL language validation and warnings
       if (options.language && ['ar', 'he', 'yi'].includes(options.language)) {
         console.log(`[PDF EXPORT] Step 4.5: Validating RTL language content for ${options.language}...`);
         const rtlValidation = validateRTLContent(markdown, options.language);
         if (rtlValidation.hasMixedContent) {
           console.warn(`[PDF EXPORT] ⚠️  Mixed language content detected in ${options.language} document`);
           console.warn(`[PDF EXPORT] ⚠️  For best results, use pure ${options.language} content only`);
         }
       }
      
      // SANITIZE: Remove only the {itshape ...} LaTeX wrapper, keep caption text
      markdown = markdown.replace(/\{itshape ([^}]+)\}/g, '$1');
      
      // SANITIZE: Remove any remaining scale comments that might have slipped through
      const beforeSanitize = markdown.length;
      markdown = markdown.replace(/<!--\s*scale:[^>]*-->/gi, '');
      markdown = markdown.replace(/&lt;!--\s*scale:[^&]*--&gt;/gi, '');
      markdown = markdown.replace(/<!-- scale:[^>]*-->/g, '');
      const afterSanitize = markdown.length;
      if (beforeSanitize !== afterSanitize) {
        console.log(`[SANITIZE] Removed ${beforeSanitize - afterSanitize} characters of scale comments`);
      }
      
      // STEP 5: Write processed markdown back to file
      fs.writeFileSync(assembledPath, markdown, 'utf8');
      console.log(`[PDF EXPORT] Updated markdown file with processed content`);
      
      // Final verification: Check if any Cloudinary URLs remain
      const finalCheck = markdown.match(/https:\/\/res\.cloudinary\.com\/[^\s]*/g);
      if (finalCheck && finalCheck.length > 0) {
        console.error(`[PDF EXPORT] ERROR: ${finalCheck.length} Cloudinary URLs still present in final markdown:`);
        finalCheck.forEach(url => console.error(`  - ${url}`));
      } else {
        console.log(`[PDF EXPORT] ✓ No Cloudinary URLs detected in final markdown`);
      }
      
      // STEP 6: Setup Pandoc arguments
      console.log(`[PDF EXPORT] Step 6: Setting up Pandoc arguments...`);
      const pageSizeKey = options.bookSize || options.papersize || "6x9";
      const estimatedPages = estimatePageCount(markdown, pageSizeKey, options.includeToc !== false);
      const pageCount = options.pageCount || options.estimatedPageCount || estimatedPages || 100;
      const hasPageNumbers = true;
      const geometry = generatePageGeometryCode(pageSizeKey, pageCount, hasPageNumbers);
      
      // Create unique temporary files
      const uniqueId = `${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
      const floatSettingsPath = path.join(tempDir, `float_settings_${uniqueId}.tex`);
      
      // Geometry is now handled via template variables, no separate header file needed
      console.log(`[GEOMETRY DEBUG] Using template geometry variables for ${pageSizeKey}:`);
      console.log(`[GEOMETRY DEBUG] ${geometry.width}x${geometry.height} with margins: ${geometry.margins.outside}in (L/R), ${geometry.margins.top}/${geometry.margins.bottom}in (T/B)`);
      
      // Enhanced float settings for better image handling
      const floatSettings = `
% --- Enhanced image and float handling ---
\\usepackage{float}
\\floatplacement{figure}{!htbp}
\\floatplacement{table}{!htbp}

% Disable figure numbering - show only caption text
\\usepackage{caption}
\\captionsetup[figure]{labelformat=empty}

% Better figure handling
\\renewcommand{\\floatpagefraction}{0.7}
\\renewcommand{\\textfraction}{0.1}
\\renewcommand{\\topfraction}{0.9}
\\renewcommand{\\bottomfraction}{0.9}
\\setcounter{topnumber}{4}
\\setcounter{bottomnumber}{4}
\\setcounter{totalnumber}{10}

% Handle missing images gracefully
\\usepackage{graphicx}
\\makeatletter
\\setlength{\\@fptop}{0pt}
\\makeatother

% Table handling
\\usepackage{tabularx}
\\usepackage{booktabs}
\\usepackage{longtable}
\\setlength\\LTleft{0pt}
\\setlength\\LTright{0pt}
\\setlength\\LTpre{8pt}
\\setlength\\LTpost{8pt}

% Error handling for missing images
\\usepackage{ifthen}
\\newcommand{\\safeinclude}[1]{%
  \\IfFileExists{#1}{\\includegraphics{#1}}{\\textit{[Image: #1 not found]}}%
}

% --- Drop cap support for fancy titles ---
% Load lettrine after all other packages are loaded
\\usepackage{lettrine}

% --- Form field support for underscore conversion ---
% Using standard LaTeX \\rule command - no additional packages needed
% Note: \\rule{width}{height} creates horizontal lines for form fields
`;
      
      fs.writeFileSync(floatSettingsPath, floatSettings);
      
      // Build Pandoc arguments
      console.log(`[PDF EXPORT] Using template: ${options.template || 'templates/custom.tex'}`)
      
      let args = [
        assembledPath,
        '-o', outputPath,
        '--from=markdown+fenced_divs+header_attributes+raw_tex+latex_macros+raw_html',
        '--to=latex',
        '--pdf-engine=xelatex',
        `--template=${options.template || 'templates/custom.tex'}`, // Dennis: Added custom template support for Arabic test
        '--standalone',
        '--variable=links-as-notes',
        '--include-in-header', floatSettingsPath
      ];
      
      // Skip geometry header injection - let template handle all geometry via variables
      console.log(`[GEOMETRY] Using template geometry variables instead of header injection for ${options.bookSize}`);
      
      // Add variables and metadata
      const pandocVars = getPandocVariables(options);
      console.log(`[PANDOC DEBUG] Variables being passed:`, pandocVars);
      pandocVars.forEach(v => args.push('--variable', v));
      getPandocMetadata(options).forEach(m => args.push('--metadata', m));
      
      // Section numbering
      if (options.numberedHeadings === true) {
        args.push('--number-sections');
      } else {
        args.push('--number-offset=0');
      }
      
      // Chapter labels
      if (options.chapterLabelFormat === 'text' || options.chapterLabelFormat !== 'none') {
        args.push('--top-level-division=chapter');
      }
      
      console.log(`[PDF EXPORT] Page size received from frontend: "${options.bookSize}"`);
      console.log(`[PDF EXPORT] Using page size: ${pageSizeKey} (${geometry.width}in x ${geometry.height}in)`);
      console.log(`[PDF EXPORT] Size object:`, geometry.size);
      console.log(`[PDF EXPORT] Estimated pages: ${estimatedPages} for margin calculation`);
      
      // STEP 7: Run Pandoc
      console.log(`[PDF EXPORT] Step 7: Running Pandoc...`);
      console.log(`[PDF EXPORT] Command: ${PANDOC_PATH} ${args.join(' ')}`);
      // Calculate default font for logging
      const exportPlatform = process.env.EXPORT_PLATFORM || 'server';
      let defaultFont = exportPlatform === 'windows' ? 'Times New Roman' : 'Liberation Serif';
      
      // Language-specific font selection for logging
      const language = options.language || 'en';
      const isRTL = language === 'ar' || language === 'he' || language === 'yi';
      const isCyrillic = language === 'ru';
      const isDevanagari = language === 'hi';
      const isTamil = language === 'ta';
      const isHebrew = language === 'he' || language === 'yi';
      
      if (isCyrillic) {
        defaultFont = 'Times New Roman';
      } else if (isHebrew) {
        defaultFont = 'Noto Sans Hebrew';
      } else if (isRTL && language === 'ar') {
        defaultFont = 'Noto Sans Arabic';
      } else if (isDevanagari) {
        defaultFont = 'Noto Sans Devanagari';
      } else if (isTamil) {
        defaultFont = 'Noto Sans Tamil';
      }
      
      console.log(`[PDF EXPORT] Template being used: templates/custom.tex`);
      console.log(`[PDF EXPORT] Font being used: ${options.fontFamily || defaultFont}`);
      console.log(`[PDF EXPORT] Language: ${language}, RTL: ${isRTL}`);
  
         execFile(PANDOC_PATH, args, { 
         maxBuffer: 1024 * 1024 * 10, // 10MB buffer
        timeout: 180000 // 3 minute timeout (increased)
       }, (error, stdout, stderr) => {
         // Function to cleanup temporary files
         const doCleanup = () => {
           const cleanupFiles = [floatSettingsPath, ...downloadedFiles];
           cleanupFiles.forEach(file => {
             try {
               if (fs.existsSync(file)) {
                 fs.unlinkSync(file);
                 console.log(`[CLEANUP] ✓ Removed: ${path.basename(file)}`);
               }
             } catch (e) {
               console.warn(`[CLEANUP] Warning: Could not remove ${file}: ${e.message}`);
             }
           });
         };
         
         if (error) {
           console.error('[PDF EXPORT] ✗ Pandoc error:', error.message);
           console.error('[PDF EXPORT] ✗ Pandoc stderr:', stderr);
          console.error('[PDF EXPORT] ✗ Pandoc stdout:', stdout);
          
          // Enhanced error analysis
          if (stderr.includes('File ') && stderr.includes(' not found')) {
            const missingFiles = stderr.match(/File `([^']+)' not found/g);
            if (missingFiles) {
              console.error('[PDF EXPORT] ✗ Missing files detected:');
              missingFiles.forEach(match => {
                const file = match.match(/File `([^']+)'/)?.[1];
                if (file) {
                  console.error(`  - ${file}`);
                  if (file.includes('cloudinary.com')) {
                    console.error(`    This looks like a Cloudinary URL that wasn't processed correctly.`);
                  }
                }
              });
            }
                     }
           
           // Cleanup on error
           doCleanup();
           return reject(new Error(`PDF generation failed: ${error.message}\nDetails: ${stderr}`));
         }
         
         if (!fs.existsSync(outputPath)) {
           doCleanup();
           return reject(new Error('PDF output file was not created'));
         }
         
         const fileSize = fs.statSync(outputPath).size;
         console.log(`[PDF EXPORT] ✓ PDF successfully created: ${outputPath} (${fileSize} bytes)`);
         console.log(`[PDF EXPORT] ✓ Processed ${cloudinaryResult.stats.total} images`);
         
         // Cleanup on success
         doCleanup();
         resolve();
      });
      
         } catch (processingError) {
       console.error('[PDF EXPORT] ✗ Processing error:', processingError);
      console.error('[PDF EXPORT] ✗ Stack trace:', processingError.stack);
       
      // Cleanup on error - only clean downloaded files
       downloadedFiles.forEach(file => {
         try {
           if (fs.existsSync(file)) {
             fs.unlinkSync(file);
             console.log(`[CLEANUP] ✓ Removed: ${path.basename(file)}`);
           }
         } catch (e) {
           console.warn(`[CLEANUP] Warning: Could not remove ${file}: ${e.message}`);
         }
       });
       
       reject(new Error(`PDF processing failed: ${processingError.message}`));
     }
  });
}

/**
 * Utility functions for debugging and analysis
 */
function isValidCloudinaryUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname === 'res.cloudinary.com' && urlObj.pathname.includes('/image/upload/');
  } catch {
    return false;
  }
}

function cleanupTempDirectory(tempDir, maxAge = 30 * 60 * 1000) {
  if (!fs.existsSync(tempDir)) return;
  
  try {
    const files = fs.readdirSync(tempDir);
    const now = Date.now();
    let cleaned = 0;
    
    files.forEach(file => {
      const filePath = path.join(tempDir, file);
      try {
        const stats = fs.statSync(filePath);
        if (now - stats.mtime.getTime() > maxAge) {
          fs.unlinkSync(filePath);
          cleaned++;
        }
      } catch (e) {
        // Ignore individual file errors
      }
    });
    
    if (cleaned > 0) {
      console.log(`[CLEANUP] ✓ Cleaned up ${cleaned} old temp files`);
    }
  } catch (error) {
    console.warn(`[CLEANUP] Warning: Could not clean temp directory: ${error.message}`);
  }
}

function analyzeMarkdownForImages(markdown) {
  const patterns = {
    'Standard Markdown': /!\[([^\]]*)\]\(([^)]+)\)/g,
    'LaTeX includegraphics': /\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}/g,
    'HTML img tags': /<img[^>]*src=["']([^"']+)["'][^>]*>/g,
    'Raw Cloudinary URLs': /https:\/\/res\.cloudinary\.com\/[^\s\[\](){}'"<>]+/g,
    'Custom {{IMAGE:...}}': /\{\{IMAGE:[^}]+\}\}/g
  };
  
  const analysis = {
    total: 0,
    byType: {},
    cloudinaryUrls: new Set(),
    localPaths: new Set(),
    issues: []
  };
  
  Object.entries(patterns).forEach(([type, pattern]) => {
    const matches = [...markdown.matchAll(pattern)];
    analysis.byType[type] = matches.length;
    analysis.total += matches.length;
    
    matches.forEach(match => {
      const url = match[1] || match[2] || match[0];
      if (url) {
        if (url.includes('cloudinary.com')) {
          analysis.cloudinaryUrls.add(url);
        } else if (!url.startsWith('http')) {
          analysis.localPaths.add(url);
        }
      }
    });
  });
  
  // Check for potential issues
  if (analysis.cloudinaryUrls.size > 0) {
    analysis.issues.push(`${analysis.cloudinaryUrls.size} Cloudinary URLs found`);
  }
  
  analysis.localPaths.forEach(path => {
    if (!fs.existsSync(path)) {
      analysis.issues.push(`Local file not found: ${path}`);
    }
  });
  
  return analysis;
}

/**
 * Validate RTL content for mixed language issues
 * Provides warnings but doesn't modify content
 */
function validateRTLContent(markdown, language) {
  console.log(`[RTL VALIDATION] Validating content for language: ${language}`);
  
  // Only validate for RTL languages
  if (!['ar', 'he', 'yi'].includes(language)) {
    return { hasMixedContent: false, issues: [] };
  }
  
  const issues = [];
  let hasMixedContent = false;
  
  // Check for common mixed content patterns
  const mixedContentPatterns = [
    { pattern: /[a-zA-Z]+/g, type: 'English text' },
    { pattern: /https?:\/\/[^\s]+/g, type: 'URLs' },
    { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, type: 'Email addresses' }
  ];
  
  mixedContentPatterns.forEach(({ pattern, type }) => {
    const matches = markdown.match(pattern);
    if (matches && matches.length > 0) {
      // Filter out LaTeX commands and environments
      const filteredMatches = matches.filter(match => 
        !match.includes('\\') && 
        !match.includes('{') && 
        !match.includes('}') &&
        !match.includes('\\begin{') && 
        !match.includes('\\end{')
      );
      
      if (filteredMatches.length > 0) {
        hasMixedContent = true;
        issues.push(`${filteredMatches.length} instances of ${type} detected`);
        console.log(`[RTL VALIDATION] Found ${filteredMatches.length} instances of ${type}`);
      }
    }
  });
  
  if (hasMixedContent) {
    console.warn(`[RTL VALIDATION] ⚠️  Mixed content detected in ${language} document`);
    console.warn(`[RTL VALIDATION] ⚠️  For best results, use pure ${language} content only`);
  } else {
    console.log(`[RTL VALIDATION] ✓ Pure ${language} content detected`);
  }
  
  return { hasMixedContent, issues };
}

module.exports = { 
  exportPdf, 
  pageSizes, 
  getDynamicMargins, 
  estimatePageCount, 
  resolveImagePaths, 
  processCloudinaryImages,
  extractAllCloudinaryUrls,
  downloadCloudinaryImagesRobust,
  downloadSingleCloudinaryImage,
  rewriteMarkdownWithStyledChapters,
  cleanupTempDirectory,
  analyzeMarkdownForImages,
  isValidCloudinaryUrl,
  debugCloudinaryProcessing,
     validateRTLContent,
  
  // Legacy compatibility (deprecated)
  findImageRecursively: (dir, filename) => {
    console.warn('[DEPRECATED] findImageRecursively - use enhanced image resolution instead');
    return null;
  },
  downloadAndReplaceCloudinaryImages: (markdown, tempDir) => {
    console.warn('[DEPRECATED] downloadAndReplaceCloudinaryImages - use processCloudinaryImages instead');
    return processCloudinaryImages(markdown, tempDir).then(result => result.markdown);
  }
};