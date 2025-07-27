const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

/**
 * OPTIMIZED: Stream and save Cloudinary image with proper error handling
 * @param {string} imageUrl - The Cloudinary URL
 * @param {string} tempDir - Temporary directory to save the image
 * @param {Object} options - Download options
 * @returns {Promise<string>} Path to the downloaded image
 */
 async function downloadCloudinaryImage(imageUrl, tempDir, options = {}) {
   return new Promise(async (resolve, reject) => {
    console.log(`[CLOUDINARY] Processing: ${imageUrl}`);
    
              // SIMPLIFIED APPROACH: Try multiple download strategies in order
      console.log(`[CLOUDINARY] Starting download attempts for: ${imageUrl}`);
      
      const cloudName = imageUrl.match(/\/\/res\.cloudinary\.com\/([^\/]+)\//)?.[1];
      if (!cloudName) {
        throw new Error(`Could not extract cloudName from URL: ${imageUrl}`);
      }
      
      // Strategy 1: Try the original URL without query parameters
      let cleanUrl = imageUrl.split('?')[0];
      console.log(`[CLOUDINARY] Strategy 1 - Clean URL (no query): ${cleanUrl}`);
    
    // Generate filename based on clean URL
    const hash = crypto.createHash('md5').update(cleanUrl).digest('hex');
    const filename = `img_${hash}.png`;
    const filepath = path.join(tempDir, filename);
    
    // Check if already downloaded (caching)
    if (fs.existsSync(filepath)) {
      console.log(`[CLOUDINARY] ✓ Using cached: ${filepath}`);
      resolve(filepath);
      return;
    }
    
    // Ensure temp directory exists
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
               // Try multiple download strategies in sequence
      const downloadStrategies = [
        cleanUrl, // Strategy 1: Original URL without query params
        imageUrl, // Strategy 2: Original URL with all params
      ];
      
      // Try to extract publicId and build additional strategies
      const publicIdMatch = imageUrl.match(/\/upload\/(?:v\d+\/)?([^?]+)/);
      if (publicIdMatch) {
        const publicId = publicIdMatch[1];
        console.log(`[CLOUDINARY] Extracted publicId: ${publicId}`);
        
        // Add strategies with extracted publicId
        downloadStrategies.push(
          `https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_auto/${publicId}`, // Strategy 3: Auto format/quality
          `https://res.cloudinary.com/${cloudName}/image/upload/${publicId}`, // Strategy 4: No transformations
          `https://res.cloudinary.com/${cloudName}/image/upload/f_png/${publicId}`, // Strategy 5: Force PNG format
          `https://res.cloudinary.com/${cloudName}/image/upload/q_auto/${publicId}` // Strategy 6: Auto quality only
        );
      }
     
     let lastError = null;
     
     const tryDownload = async (url, strategyName) => {
       console.log(`[CLOUDINARY] ${strategyName}: ${url}`);
       
       return new Promise((resolveDownload, rejectDownload) => {
         const request = https.get(url, (response) => {
           if (response.statusCode === 301 || response.statusCode === 302) {
             console.log(`[CLOUDINARY] Following redirect to: ${response.headers.location}`);
             return tryDownload(response.headers.location, `${strategyName} (redirect)`)
               .then(resolveDownload)
               .catch(rejectDownload);
           }
           
           if (response.statusCode !== 200) {
             rejectDownload(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
             return;
           }
      
                 const chunks = [];
           let totalSize = 0;
           
           response.on('data', chunk => {
             chunks.push(chunk);
             totalSize += chunk.length;
             
             // Prevent extremely large downloads
             if (totalSize > 50 * 1024 * 1024) { // 50MB limit
               request.destroy();
               rejectDownload(new Error('Image too large (>50MB)'));
               return;
             }
           });
           
           response.on('end', () => {
             try {
               const buffer = Buffer.concat(chunks);
               fs.writeFileSync(filepath, buffer);
               console.log(`[CLOUDINARY] ✓ Downloaded: ${filename} (${buffer.length} bytes) using ${strategyName}`);
               resolveDownload(filepath);
             } catch (error) {
               rejectDownload(new Error(`Failed to save image: ${error.message}`));
             }
           });
           
           response.on('error', error => {
             rejectDownload(new Error(`Response error: ${error.message}`));
           });
         });
         
         request.on('error', error => {
           rejectDownload(new Error(`Request error: ${error.message}`));
         });
         
         request.setTimeout(options.timeout || 30000, () => {
           request.destroy();
           rejectDownload(new Error(`Download timeout for ${url}`));
         });
       });
     };
     
     // Try each strategy in sequence until one succeeds
     for (let i = 0; i < downloadStrategies.length; i++) {
       try {
         const result = await tryDownload(downloadStrategies[i], `Strategy ${i + 1}`);
         resolve(result);
         return;
       } catch (error) {
         lastError = error;
         console.log(`[CLOUDINARY] Strategy ${i + 1} failed: ${error.message}`);
       }
     }
     
     // If all strategies failed
     reject(new Error(`All download strategies failed. Last error: ${lastError?.message}`));
  });
}

/**
 * ENHANCED: Process markdown to handle ALL Cloudinary URL patterns
 * @param {string} markdown - The markdown content
 * @param {string} tempDir - Temporary directory for downloaded images
 * @returns {Promise<string>} Processed markdown with local image paths
 */
 async function processCloudinaryImages(markdown, tempDir) {
   console.log(`[CLOUDINARY] Starting comprehensive image processing`);
   console.log(`[CLOUDINARY] Markdown length: ${markdown.length} characters`);
   
       // Debug: Show first few lines that contain cloudinary or custom image syntax
    const lines = markdown.split('\n');
    const cloudinaryLines = lines.filter(line => line.includes('cloudinary.com'));
    const customImageLines = lines.filter(line => line.includes('{{IMAGE:'));
    console.log(`[CLOUDINARY] Found ${cloudinaryLines.length} lines containing 'cloudinary.com':`);
    console.log(`[CLOUDINARY] Found ${customImageLines.length} lines containing '{{IMAGE:':`);
    
    // Show custom image lines first
    customImageLines.slice(0, 5).forEach((line, i) => {
      console.log(`[CLOUDINARY] Custom Image Line ${i + 1}: ${line}`);
    });
    
    // Show cloudinary lines
    cloudinaryLines.slice(0, 5).forEach((line, i) => {
      console.log(`[CLOUDINARY] Cloudinary Line ${i + 1}: ${line}`);
    });
   
            // Enhanced regex patterns to catch all Cloudinary URL variations
    const patterns = [
      // Custom {{IMAGE:url|alt|scale}} syntax - MOST IMPORTANT for this system
      /\{\{IMAGE:(https:\/\/res\.cloudinary\.com\/[^|]+)\|([^|]*)\|([^}]*)\}\}/g,
      // Standard markdown images: ![alt](url)
      /!\[([^\]]*)\]\((https:\/\/res\.cloudinary\.com\/[^)]+)\)/g,
      // LaTeX includegraphics with careful boundary detection
      /\\includegraphics(?:\[[^\]]*\])?\{(https:\/\/res\.cloudinary\.com\/[^}]+?)\}/g,
      // HTML img tags
      /<img[^>]*src=["'](https:\/\/res\.cloudinary\.com\/[^"']+)["'][^>]*>/g,
      // Raw URLs in text - with better boundary detection
      /(?<![\w\/.])https:\/\/res\.cloudinary\.com\/[^\s\[\](){}'"<>}]+(?=[^a-zA-Z0-9\-_.\/:?&=%]|$)/g
    ];
  
     const allMatches = new Set();
   let processedMarkdown = markdown;
   
   // STEP 1: Convert custom {{IMAGE:...}} syntax to standard markdown
   console.log(`[CLOUDINARY] Step 1: Converting custom {{IMAGE:...}} syntax to markdown`);
   const customImagePattern = /\{\{IMAGE:(https:\/\/res\.cloudinary\.com\/[^|]+)\|([^|]*)\|([^}]*)\}\}/g;
   let customImageMatches = 0;
   
   processedMarkdown = processedMarkdown.replace(customImagePattern, (match, url, alt, scale) => {
     customImageMatches++;
     console.log(`[CLOUDINARY] Converting custom image ${customImageMatches}: ${alt} (scale: ${scale})`);
     console.log(`[CLOUDINARY] URL: ${url}`);
     
     // Convert to markdown with scale information in a comment for later processing
     const scaleValue = parseFloat(scale) || 1.0;
     return `![${alt}](${url})<!-- scale:${scaleValue} -->`;
   });
   
   console.log(`[CLOUDINARY] Converted ${customImageMatches} custom image(s) to markdown format`);
  
           // Find all unique Cloudinary URLs with enhanced debugging
    // Search in BOTH original markdown (for custom syntax) AND processed markdown (for converted content)
    const searchTargets = [
      { name: 'original markdown', content: markdown },
      { name: 'processed markdown', content: processedMarkdown }
    ];
    
    searchTargets.forEach(target => {
      console.log(`[CLOUDINARY] Searching in ${target.name}...`);
      
      patterns.forEach((pattern, index) => {
        console.log(`[CLOUDINARY] Testing pattern ${index + 1} in ${target.name}: ${pattern.source}`);
        let match;
        let patternMatches = 0;
        
        // Create a fresh regex to avoid state issues
        const freshPattern = new RegExp(pattern.source, pattern.flags);
        
        while ((match = freshPattern.exec(target.content)) !== null) {
          patternMatches++;
          console.log(`[CLOUDINARY] Pattern ${index + 1} match ${patternMatches} in ${target.name}:`, match);
          
          // Extract URL (might be in different capture groups depending on pattern)
          let url = null;
          if (match[1]?.startsWith('https://')) {
            url = match[1]; // Custom {{IMAGE:...}} syntax, standard markdown, LaTeX, HTML
          } else if (match[2]?.startsWith('https://')) {
            url = match[2]; // Some LaTeX patterns with parameters
          } else if (match[0]?.startsWith('https://')) {
            url = match[0]; // Raw URL patterns
          }
          
          if (url) {
            // Clean up any trailing characters that might have been captured
            url = url.replace(/[}\])]$/, '');
            console.log(`[CLOUDINARY] Found URL: ${url}`);
            allMatches.add(url);
          } else {
            console.log(`[CLOUDINARY] No valid URL found in match:`, match);
          }
        }
        
        console.log(`[CLOUDINARY] Pattern ${index + 1} found ${patternMatches} matches in ${target.name}`);
      });
    });
  
  const uniqueUrls = Array.from(allMatches);
  console.log(`[CLOUDINARY] Found ${uniqueUrls.length} unique Cloudinary URLs`);
  
  if (uniqueUrls.length === 0) {
    console.log(`[CLOUDINARY] No Cloudinary images found`);
    return {
      markdown: markdown,
      downloadedFiles: [],
      stats: { successful: 0, failed: 0, total: 0 }
    };
  }
  
  // Log first few URLs for debugging
  console.log(`[CLOUDINARY] Sample URLs:`, uniqueUrls.slice(0, 3));
  
  // Download all images concurrently (with limit)
  const downloadPromises = uniqueUrls.map(async (url, index) => {
    try {
      // Add delay to prevent overwhelming Cloudinary
      await new Promise(resolve => setTimeout(resolve, index * 100));
      
      const localPath = await downloadCloudinaryImage(url, tempDir);
      const filename = path.basename(localPath);
      
      return { 
        original: url, 
        localPath, 
        filename, 
        success: true 
      };
    } catch (error) {
      console.error(`[CLOUDINARY] ✗ Failed to download: ${url} - ${error.message}`);
      return { 
        original: url, 
        error: error.message, 
        success: false 
      };
    }
  });
  
  // Process downloads in batches of 5
  const batchSize = 5;
  const results = [];
  
  for (let i = 0; i < downloadPromises.length; i += batchSize) {
    const batch = downloadPromises.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(batch);
    
    batchResults.forEach(result => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        console.error(`[CLOUDINARY] Batch error:`, result.reason);
      }
    });
    
    // Small delay between batches
    if (i + batchSize < downloadPromises.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
        // Replace URLs with local filenames and handle scaling
   results.forEach(result => {
     if (result.success) {
       console.log(`[CLOUDINARY] Replacing: ${result.original} -> ${result.filename}`);
       
       // Look for markdown images with this URL and handle scaling
       const urlToReplace = result.original;
       const escapedUrl = urlToReplace.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
       
       // Pattern to find markdown images with scale comments
       const markdownWithScale = new RegExp(`!\\[([^\\]]*)\\]\\(${escapedUrl}\\)<!-- scale:([0-9.]+) -->`, 'g');
       
       let replacementCount = 0;
       
       // Replace markdown images with scaling
       processedMarkdown = processedMarkdown.replace(markdownWithScale, (match, alt, scale) => {
         replacementCount++;
         const scaleValue = parseFloat(scale);
         console.log(`[CLOUDINARY] Applying scale ${scaleValue} to image: ${alt}`);
         
                 // Create LaTeX with proper scaling using full path
          if (scaleValue && scaleValue !== 1.0) {
            return `\\includegraphics[width=${scaleValue}\\textwidth]{${result.localPath}}`;
          } else {
            return `\\includegraphics{${result.localPath}}`;
          }
       });
       
               // Replace any remaining instances without scale info
        const basicMarkdown = new RegExp(`!\\[([^\\]]*)\\]\\(${escapedUrl}\\)`, 'g');
        processedMarkdown = processedMarkdown.replace(basicMarkdown, (match, alt) => {
          replacementCount++;
          return `\\includegraphics{${result.localPath}}`;
        });
       
               // Replace any remaining raw URLs
        while (processedMarkdown.includes(urlToReplace)) {
          processedMarkdown = processedMarkdown.replace(urlToReplace, result.localPath);
          replacementCount++;
         
         // Safety check to prevent infinite loops
         if (replacementCount > 100) {
           console.warn(`[CLOUDINARY] Too many replacements for ${urlToReplace}, stopping to prevent infinite loop`);
           break;
         }
       }
       
               console.log(`[CLOUDINARY] ✓ Replaced ${replacementCount} instances: ${result.original} -> ${result.localPath}`);
     } else {
       // Handle failed downloads by replacing the entire image syntax, not just the URL
       console.log(`[CLOUDINARY] Replacing failed download with LaTeX text: ${result.original}`);
       const urlToReplace = result.original;
       const escapedUrl = urlToReplace.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
       const cleanFilename = path.basename(result.original).replace(/\?.*$/, '');
       const placeholderText = `\\textit{[Image unavailable: ${cleanFilename}]}`;
       
       // Handle markdown images with scale comments
       const markdownWithScale = new RegExp(`!\\[([^\\]]*)\\]\\(${escapedUrl}\\)<!-- scale:([0-9.]+) -->`, 'g');
       processedMarkdown = processedMarkdown.replace(markdownWithScale, placeholderText);
       
       // Handle basic markdown images
       const basicMarkdown = new RegExp(`!\\[([^\\]]*)\\]\\(${escapedUrl}\\)`, 'g');
       processedMarkdown = processedMarkdown.replace(basicMarkdown, placeholderText);
       
       // Handle other image contexts
       const imagePatterns = [
         // LaTeX includegraphics: \includegraphics{url} -> LaTeX text
         new RegExp(`\\\\includegraphics(?:\\[[^\\]]*\\])?\\{${escapedUrl}\\}`, 'g'),
         // HTML img tags: <img src="url"> -> LaTeX text
         new RegExp(`<img[^>]*src=["']${escapedUrl}["'][^>]*>`, 'g')
       ];
       
       let replaced = false;
       imagePatterns.forEach(pattern => {
         if (pattern.test(processedMarkdown)) {
           processedMarkdown = processedMarkdown.replace(pattern, placeholderText);
           replaced = true;
         }
       });
       
       // Fallback: if no specific pattern matched, do simple URL replacement
       if (!replaced && processedMarkdown.includes(urlToReplace)) {
         while (processedMarkdown.includes(urlToReplace)) {
           processedMarkdown = processedMarkdown.replace(urlToReplace, placeholderText);
         }
         replaced = true;
       }
       
       console.log(`[CLOUDINARY] ✓ Replaced failed download: ${result.original} -> ${replaced ? 'LaTeX text' : 'not found'}`);
     }
   });
  
  // Final verification with enhanced URL detection
  const remainingUrlPatterns = [
    /https:\/\/res\.cloudinary\.com\/[^\s\[\](){}'"<>]+/g,
    /https:\/\/res\.cloudinary\.com\/[^)\s}'"]+/g,
    /res\.cloudinary\.com\/[^)\s}'"]+/g
  ];
  
  let allRemainingUrls = new Set();
  remainingUrlPatterns.forEach(pattern => {
    const matches = processedMarkdown.match(pattern);
    if (matches) {
      matches.forEach(url => allRemainingUrls.add(url));
    }
  });
  
  if (allRemainingUrls.size > 0) {
    console.warn(`[CLOUDINARY] WARNING: ${allRemainingUrls.size} URLs still remain:`);
    Array.from(allRemainingUrls).forEach(url => console.warn(`  - ${url}`));
    
    // Try to understand why they weren't replaced
    allRemainingUrls.forEach(url => {
      const matchingResult = results.find(r => r.original === url);
      if (matchingResult) {
        console.warn(`  > This URL was processed but not replaced: success=${matchingResult.success}`);
      } else {
        console.warn(`  > This URL was not found in processing results`);
      }
    });
  } else {
    console.log(`[CLOUDINARY] ✓ All URLs successfully processed`);
  }
  
     const successful = results.filter(r => r.success).length;
   const failed = results.length - successful;
   console.log(`[CLOUDINARY] Processing complete: ${successful} successful, ${failed} failed`);
   
   // Final safety check: remove any remaining problematic patterns
   console.log(`[CLOUDINARY] Running final safety checks...`);
   
       // Remove any LaTeX commands that might still contain problematic URLs
    const problemPatterns = [
      // Remove any remaining custom {{IMAGE:...}} syntax
      /\{\{IMAGE:[^}]*\}\}/g,
      // Remove any includegraphics commands with URLs or problematic characters
      /\\includegraphics(?:\[[^\]]*\])?\{[^}]*cloudinary\.com[^}]*\}/g,
      /\\includegraphics(?:\[[^\]]*\])?\{[^}]*\?[^}]*\}/g,
      // Remove any markdown images with problematic URLs
      /!\[[^\]]*\]\([^)]*cloudinary\.com[^)]*\)/g,
      /!\[[^\]]*\]\([^)]*\?[^)]*\)/g
    ];
   
   problemPatterns.forEach((pattern, index) => {
     const matches = processedMarkdown.match(pattern);
     if (matches) {
       console.warn(`[CLOUDINARY] Safety check ${index + 1}: Found ${matches.length} problematic patterns`);
       matches.forEach(match => console.warn(`[CLOUDINARY] Problematic pattern: ${match}`));
       processedMarkdown = processedMarkdown.replace(pattern, '\\textit{[Image processing error]}');
     }
   });
   
   console.log(`[CLOUDINARY] Final safety checks complete`);
   
   return {
     markdown: processedMarkdown,
     downloadedFiles: results.filter(r => r.success).map(r => r.localPath),
     stats: { successful, failed, total: results.length }
   };
}

/**
 * Enhanced image path resolution with better error handling
 */
 function resolveImagePaths(markdown, basePath) {
   console.log(`[IMAGE RESOLUTION] Starting resolution from: ${basePath}`);
   
   // Only process remaining markdown images (not LaTeX includegraphics)
   return markdown.replace(/!\[([^\]]*)\]\(([^)]+)\)(?!<!-- scale)/g, (match, alt, imagePath) => {
     // Skip URLs (should already be processed)
     if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
       console.log(`[IMAGE RESOLUTION] Skipping URL: ${imagePath}`);
       return match;
     }
     
     // Skip if it looks like a processed filename (img_hash.png)
     if (imagePath.match(/^img_[a-f0-9]+\.png$/)) {
       console.log(`[IMAGE RESOLUTION] Skipping processed image: ${imagePath}`);
       return `\\includegraphics{${imagePath}}`;
     }
     
     // Skip if already absolute
     if (path.isAbsolute(imagePath)) {
       if (fs.existsSync(imagePath)) {
         return `\\includegraphics{${imagePath}}`;
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
         return `\\includegraphics{${searchPath}}`;
       }
     }
     
     console.warn(`[IMAGE RESOLUTION] ✗ Not found: ${imagePath}`);
     return `\\textit{[Image not found: ${path.basename(imagePath)}]}`;
   });
 }

// Page Size Mappings (same as original)
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
  "8.5x11": { width: "8.5in", height: "11in" }
};

// Calculate margins (same logic as original)
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
    case "8.5x11":
      outside = Math.max(outside, 0.525);
      top = Math.max(top, 0.5);
      bottom = Math.max(bottom, 0.5);
      break;
    default:
      outside = Math.max(outside, 0.425);
  }

  if (hasPageNumbers) {
    bottom += 0.25;
  }

  outside += 0.3;

  console.log(`[KDP MARGINS] ${pageSizeKey}, ${pageCount} pages: inside=${inside}", outside=${outside}", top=${top}", bottom=${bottom}"`);

  return { inside, outside, top, bottom };
}

/**
 * Estimate page count (same logic as original)
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
  const footskip = hasPageNumbers ? '0.25in' : '0.40in';

  return {
    size,
    margins,
    width,
    height,
    textWidth,
    textHeight,
    latexCode: `
% --- AMAZON KDP COMPLIANT PAGE SIZE AND MARGINS ---
\\usepackage[
  paperwidth=${width}in,
  paperheight=${height}in,
  left=${margins.outside}in,
  right=${margins.outside}in,
  top=${margins.top}in,
  bottom=${margins.bottom}in,
  footskip=${footskip},
  bindingoffset=0pt
]{geometry}

% --- Enhanced image handling for better PDF generation ---
\\usepackage{graphicx}
\\usepackage{float}
\\usepackage{adjustbox}

% Set default image width to respect text width
\\setkeys{Gin}{width=\\linewidth,height=\\textheight,keepaspectratio}

% Enhanced includegraphics command that auto-scales oversized images
\\let\\oldincludegraphics\\includegraphics
\\renewcommand{\\includegraphics}[2][]{%
  \\adjustbox{max width=\\textwidth,max height=0.8\\textheight,center}{%
    \\oldincludegraphics[#1]{#2}%
  }%
}

% --- Enable Pandoc .center divs ---
\\usepackage{etoolbox}
\\makeatletter
\\def\\markdownRendererDivClasscenter#1{%
  \\begin{center}#1\\end{center}%
}
\\makeatother

% --- Better text handling ---
\\usepackage{microtype}
\\usepackage{url}
\\usepackage{xurl}
\\usepackage{hyphenat}
\\usepackage{seqsplit}
\\urlstyle{same}

% --- Justification ---
\\usepackage{ragged2e}
\\AtBeginDocument{\\justifying}

% --- Page numbers ---
\\usepackage{fancyhdr}
\\pagestyle{fancy}
\\fancyhf{}
\\fancyfoot[C]{\\thepage}
\\renewcommand{\\headrulewidth}{0pt}
\\renewcommand{\\footrulewidth}{0pt}

% --- PDF dimensions ---
\\pdfpagewidth=${width}in
\\pdfpageheight=${height}in
\\special{papersize=${width}in,${height}in}

% --- Text flow ---
\\tolerance=3000
\\emergencystretch=3em
\\hbadness=10000
\\vfuzz=30pt
\\hfuzz=30pt
\\setlength{\\rightskip}{0pt plus 5pt}
\\parfillskip=0pt plus 0.75\\textwidth
\\sloppy
\\setlength{\\parindent}{1em}
`
  };
}

// Helper functions (same as original)
function getPandocVariables(options) {
  const vars = [];
  vars.push(`documentclass=${options.documentclass || (options.bindingType === 'hardcover' ? 'report' : 'book')}`);
  vars.push(`fontsize=${options.fontsize || '12pt'}`);
  if (options.includeBleed === true) {
    vars.push('bleed=true');
    vars.push('bleedmargin=0.125in');
  }
  vars.push('mainfont=Liberation Serif');
  vars.push('secstyle=\\Large\\bfseries\\filcenter');
  vars.push('pagestyle=empty');
  vars.push('disable-headers=true');
  vars.push('plainfoot=');
  vars.push('emptyfoot=');
  if (options.includeToc !== false) {
    vars.push('toc-title=CONTENTS');
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
    (match, content) => `\\begin{center}\n${content.trim()}\n\\end{center}`
  );
  markdown = markdown.replace(
    /::: *\{\.right\}[\r\n]+([\s\S]*?)[\r\n]+:::/g,
    (match, content) => `\\begin{flushright}\n${content.trim()}\n\\end{flushright}`
  );
  return markdown;
}

/**
 * MAIN EXPORT FUNCTION - Completely rewritten for reliability
 */
async function exportPdf(assembledPath, outputPath, options = {}) {
  return new Promise(async (resolve, reject) => {
    console.log(`[PDF EXPORT] Starting export: ${assembledPath} -> ${outputPath}`);
    
    const tempDir = path.dirname(assembledPath);
    let downloadedFiles = [];
    
    try {
      // Read original markdown
      let markdown = fs.readFileSync(assembledPath, 'utf8');
      console.log(`[PDF EXPORT] Read ${markdown.length} characters from ${assembledPath}`);
      
      // STEP 1: Process Cloudinary images
      console.log(`[PDF EXPORT] Step 1: Processing Cloudinary images...`);
      const cloudinaryResult = await processCloudinaryImages(markdown, tempDir);
      markdown = cloudinaryResult.markdown;
      downloadedFiles = cloudinaryResult.downloadedFiles;
      
             console.log(`[PDF EXPORT] Cloudinary processing stats:`, cloudinaryResult.stats);
       
       // DEBUG: Add processing summary to the response for frontend debugging
       if (cloudinaryResult.stats.total > 0) {
         console.log(`[PDF EXPORT] ✓ Processed ${cloudinaryResult.stats.successful} images successfully`);
         console.log(`[PDF EXPORT] ✗ Failed to process ${cloudinaryResult.stats.failed} images`);
       } else {
         console.log(`[PDF EXPORT] ⚠️  No Cloudinary images found in markdown`);
         console.log(`[PDF EXPORT] First 500 chars of markdown:`, markdown.substring(0, 500));
       }
      
      // STEP 2: Resolve any remaining image paths
      console.log(`[PDF EXPORT] Step 2: Resolving remaining image paths...`);
      const basePath = path.dirname(assembledPath);
      markdown = resolveImagePaths(markdown, basePath);
      
      // STEP 3: Apply proper chapter styling
      console.log(`[PDF EXPORT] Step 3: Applying chapter styling...`);
      markdown = rewriteMarkdownWithStyledChapters(markdown);
      
      // STEP 4: Convert alignment divs
      console.log(`[PDF EXPORT] Step 4: Converting alignment divs...`);
      markdown = convertAlignmentDivsToLatex(markdown);
      
      // STEP 5: Write processed markdown back to file
      fs.writeFileSync(assembledPath, markdown, 'utf8');
      console.log(`[PDF EXPORT] Updated markdown file with processed content`);
      
      // Additional verification: Check if any Cloudinary URLs remain in the final markdown
      const finalCheck = markdown.match(/https:\/\/res\.cloudinary\.com\/[^\s]*/g);
      if (finalCheck && finalCheck.length > 0) {
        console.error(`[PDF EXPORT] ERROR: ${finalCheck.length} Cloudinary URLs still present in final markdown:`);
        finalCheck.forEach(url => console.error(`  - ${url}`));
      } else {
        console.log(`[PDF EXPORT] ✓ No Cloudinary URLs detected in final markdown`);
      }
      
      // STEP 6: Setup Pandoc arguments
      console.log(`[PDF EXPORT] Step 6: Setting up Pandoc arguments...`);
      const pageSizeKey = options.papersize || "6x9";
      const estimatedPages = estimatePageCount(markdown, pageSizeKey, options.includeToc !== false);
      const pageCount = options.estimatedPageCount || estimatedPages || 100;
      const hasPageNumbers = true;
      const geometry = generatePageGeometryCode(pageSizeKey, pageCount, hasPageNumbers);
      
      // Create unique temporary files
      const uniqueId = `${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
      const tmpHeaderPath = path.join(tempDir, `page_geometry_${uniqueId}.tex`);
      const floatSettingsPath = path.join(tempDir, `float_settings_${uniqueId}.tex`);
      
      // Write geometry settings
      fs.writeFileSync(tmpHeaderPath, geometry.latexCode);
      
      // Enhanced float settings for better image handling
      const floatSettings = `
% --- Enhanced image and float handling ---
\\usepackage{float}
\\floatplacement{figure}{!htbp}
\\floatplacement{table}{!htbp}

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
`;
      
      fs.writeFileSync(floatSettingsPath, floatSettings);
      
      // Build Pandoc arguments
      let args = [
        assembledPath,
        '-o', outputPath,
        '--from=markdown+fenced_divs+header_attributes+raw_tex+latex_macros+raw_html',
        '--to=latex',
        '--pdf-engine=xelatex',
        '--template=templates/custom.tex',
        '--standalone',
        '--variable=links-as-notes',
        '--include-in-header', tmpHeaderPath,
        '--include-in-header', floatSettingsPath
      ];
      
      // Add variables and metadata
      getPandocVariables(options).forEach(v => args.push('--variable', v));
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
      
      console.log(`[PDF EXPORT] Using page size: ${pageSizeKey} (${geometry.width}in x ${geometry.height}in)`);
      console.log(`[PDF EXPORT] Estimated pages: ${estimatedPages} for margin calculation`);
      
      // STEP 6: Run Pandoc
      console.log(`[PDF EXPORT] Step 5: Running Pandoc...`);
      console.log(`[PDF EXPORT] Command: pandoc ${args.join(' ')}`);
      
             execFile('pandoc', args, { 
         maxBuffer: 1024 * 1024 * 10, // 10MB buffer
         timeout: 120000 // 2 minute timeout
       }, (error, stdout, stderr) => {
         // Function to cleanup temporary files
         const doCleanup = () => {
           const cleanupFiles = [tmpHeaderPath, floatSettingsPath, ...downloadedFiles];
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
       
       // Cleanup on error - only clean downloaded files, not LaTeX files that may not exist yet
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
 * Enhanced chapter styling function
 */
function rewriteMarkdownWithStyledChapters(markdown) {
  const lines = markdown.split('\n');
  let chapter = 1;
  const output = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const h1Match = /^# (?!#)(.*)/.exec(line);
    
    if (h1Match) {
      const headingText = h1Match[1].trim();
      
      if (output.length > 0 && output[output.length - 1].trim() !== '') {
        output.push('');
      }
      
      output.push('```{=latex}');
      output.push('\\begin{center}');
      output.push(`{\\fontsize{24pt}{28pt}\\selectfont\\textbf{Chapter ${chapter++}}}\\\\[0.5em]`);
      output.push(`{\\fontsize{16pt}{20pt}\\selectfont\\textit{${headingText}}}`);
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
 * Utility function to validate Cloudinary URLs
 */
function isValidCloudinaryUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname === 'res.cloudinary.com' && urlObj.pathname.includes('/image/upload/');
  } catch {
    return false;
  }
}

/**
 * Utility function to clean up temp directory
 */
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

/**
 * Enhanced error reporting for debugging
 */
function analyzeMarkdownForImages(markdown) {
  const patterns = {
    'Standard Markdown': /!\[([^\]]*)\]\(([^)]+)\)/g,
    'LaTeX includegraphics': /\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}/g,
    'HTML img tags': /<img[^>]*src=["']([^"']+)["'][^>]*>/g,
    'Raw Cloudinary URLs': /https:\/\/res\.cloudinary\.com\/[^\s\[\](){}'"<>]+/g
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

module.exports = { 
  exportPdf, 
  pageSizes, 
  getDynamicMargins, 
  estimatePageCount, 
  resolveImagePaths, 
  downloadCloudinaryImage,
  processCloudinaryImages,
  rewriteMarkdownWithStyledChapters,
  cleanupTempDirectory,
  analyzeMarkdownForImages,
  isValidCloudinaryUrl,
  
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