require('dotenv').config(); // Yancy D Dennis
const express = require('express');
const cors = require('cors');
const { execFile, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
// Image processing is handled by exportPdf function
const Epub = require('epub-gen');
const multer = require('multer');
const { exec } = require('child_process');
const util = require('util');
const axios = require('axios');
const cheerio = require('cheerio');
const { assembleBookPlain } = require('./assembleBookPlain');
const marked = require('marked');
const { exportBook } = require('./exportBook');
const { exportEpub } = require('./exportEpub');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const { exportPdf } = require('./exportPdf');
const { assembleBookPdf } = require('./bookAssemblerPdf');
const { assembleBookEpub } = require('./bookAssemblerEpub');
const { assembleBookDocx } = require('./bookAssemblerDocx');
const { saveDebugFile } = require('./utils');
const { getTocTitle } = require('./translations');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
// Use the same JWT secret as the main backend
const JWT_SECRET = process.env.JWT_ACCESS_TOKEN_SECRET || process.env.JWT_SECRET || 'changeme';

// Import Cloudinary upload solution
const { optimizedImageUpload, optimizeMarkdownForPDF } = require('./cloudinary-uploads');

// Debug JWT secret loading
console.log('Export backend JWT_SECRET loaded:', JWT_SECRET ? `${JWT_SECRET.substring(0, 10)}...` : 'NOT FOUND');
console.log('Export backend environment variables:', {
  JWT_ACCESS_TOKEN_SECRET: process.env.JWT_ACCESS_TOKEN_SECRET ? 'SET' : 'NOT SET',
  JWT_SECRET: process.env.JWT_SECRET ? 'SET' : 'NOT SET',
  NODE_ENV: process.env.NODE_ENV || 'NOT SET'
});
const User = require('./models/User'); // Import User model for subscription checks (local to export-backend)
const { upscaleImage, KDP_SIZES } = require('./imagemagic'); // Import ImageMagic module

// Helper for promisifying exec
const execPromise = util.promisify(exec);

// Use custom Pandoc version if available, fallback to system pandoc
// Handle Windows vs Linux defaults properly
const PANDOC_PATH = process.env.PANDOC_PATH || 
  (process.platform === 'win32' ? 'pandoc' : '/root/.cache/pandoc-3.6.4');

const app = express();

// Import rate limiting middleware
const rateLimiting = require('./middleware/rateLimiting');
// const mongoSanitize = require('express-mongo-sanitize');

// MongoDB sanitization temporarily disabled due to Express 5 compatibility issues
// Main backend already provides comprehensive input sanitization
console.log('ℹ️ MongoDB sanitization disabled - relying on main backend sanitization for security');

// Update CORS configuration to explicitly allow frontend connections
app.use(cors({
  origin: true, //['https://publishjockey-frontend.vercel.app','http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Disposition'] // Expose Content-Disposition header for downloads
}));

// Apply general rate limiting to all routes
app.use(rateLimiting.general);

app.use(express.json({ limit: '100mb' }));

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Temporary file tracking for cleanup
const tempExportFiles = new Map();

// We use a dedicated API endpoint for file access instead of static file serving
// This prevents automatic downloads and gives us more control over file access
// See the '/api/files/:fileId' route below

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'uploads'));
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB limit
  fileFilter: (req, file, cb) => {
    // Accept only specific file types
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || // docx
        file.mimetype === 'text/markdown' ||
        file.mimetype === 'text/plain') {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Only DOCX, Markdown, and TXT files are allowed.'), false);
    }
  }
});

// Multer instance for cover image uploads (only allow jpg, jpeg, png)
const coverUpload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Only JPEG and PNG images are allowed.'), false);
    }
  }
});

// Make sure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

/**
 * POST /import
 * Handles file uploads and converts to markdown
 * Supports: .docx, .md, .txt
 */
app.post('/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const fileExt = path.extname(req.file.originalname).toLowerCase();
    
    console.log(`Processing import for file: ${req.file.originalname} (${fileExt})`);
    let markdown = '';

    try {
      // Handle different file types
      if (fileExt === '.docx') {
        // Convert DOCX to markdown using pandoc
        const outputPath = `${filePath}.md`;
        await execPromise(`"${PANDOC_PATH}" "${filePath}" -f docx -t markdown -o "${outputPath}"`);
        markdown = fs.readFileSync(outputPath, 'utf8');
        
        // Clean up the temporary markdown file
        fs.unlinkSync(outputPath);
      } else if (fileExt === '.md' || fileExt === '.markdown') {
        // Already markdown, just read it - simple approach without validation
        markdown = fs.readFileSync(filePath, 'utf8');
        console.log(`Markdown file imported successfully (${markdown.length} bytes)`);
      } else if (fileExt === '.txt') {
        // Plain text - read and convert line breaks to markdown
        const text = fs.readFileSync(filePath, 'utf8');
        markdown = text.replace(/\r\n|\r|\n/g, '\n\n');
      } else {
        throw new Error(`Unsupported file type: ${fileExt}`);
      }

      // Clean up the uploaded file
      fs.unlinkSync(filePath);
      
      // Return the markdown content
      return res.json({ 
        success: true, 
        markdown,
        message: 'File imported successfully' 
      });
    } catch (error) {
      console.error('Error processing file:', error);
      
      // Clean up the uploaded file if it exists
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      
      return res.status(500).json({ 
        error: 'Failed to process the file',
        details: error.message 
      });
    }
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ 
      error: 'File upload failed',
      details: error.message 
    });
  }
});

/**
 * POST /import/google
 * Handles importing from Google Docs URLs
 * Expects: { url: string } - URL to a shared Google Doc
 * Returns: { success: boolean, markdown: string }
 */
app.post('/import/google', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'No Google Docs URL provided' });
    }

    console.log('Importing from Google Docs URL:', url);
    
    // Validate it's a Google Docs URL
    if (!url.includes('docs.google.com')) {
      return res.status(400).json({ error: 'Invalid Google Docs URL' });
    }

    try {
      // --- Extract the document ID from the URL ---
      const match = url.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
      if (!match) {
        return res.status(400).json({ error: 'Could not extract document ID from URL.' });
      }
      const docId = match[1];
      const docxUrl = `https://docs.google.com/document/d/${docId}/export?format=docx`;
      console.log('Fetching DOCX from:', docxUrl);

      // --- Download the DOCX file ---
      const docxResponse = await axios.get(docxUrl, { responseType: 'arraybuffer' });
      const tempDir = path.join(__dirname, 'temp');
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
      const tempDocxPath = path.join(tempDir, `gdoc_${docId}_${Date.now()}.docx`);
      const tempMdPath = tempDocxPath.replace(/\.docx$/, '.md');
      fs.writeFileSync(tempDocxPath, docxResponse.data);

      // --- Convert DOCX to Markdown using Pandoc ---
      await execPromise(`"${PANDOC_PATH}" "${tempDocxPath}" -f docx -t markdown -o "${tempMdPath}"`);
      const markdown = fs.readFileSync(tempMdPath, 'utf8');

      // --- Clean up temp files ---
      fs.unlinkSync(tempDocxPath);
      fs.unlinkSync(tempMdPath);

      // --- Return the clean Markdown ---
      return res.json({
        success: true,
        markdown,
        message: 'Google Doc imported successfully'
      });
    } catch (error) {
      console.error('Google Docs import error:', error);
      return res.status(500).json({
        error: 'Failed to import from Google Docs',
        details: error.message
      });
    }
  } catch (error) {
    console.error('Google Docs import error:', error);
    return res.status(500).json({
      error: 'Google Docs import failed',
      details: error.message
    });
  }
});

/**
 * POST /export/pdf
 * Expects: { sections: array, exportOptions: object }
 * Returns: PDF file generated by Pandoc
 */
/**
 * POST /export/pdf
 * Expects: { sections: array, exportOptions: object }
 * Returns: PDF file generated by Pandoc
 */
app.post('/export/pdf', rateLimiting.export, authenticateJWT, async (req, res) => {
  try {
    // Debugging: log received fontFamily and exportOptions
    console.log('Received fontFamily from frontend:', req.body.exportOptions?.fontFamily);
    console.log('Full exportOptions received:', req.body.exportOptions);

    console.log('\n==================== PDF EXPORT REQUEST ====================');
    console.log('FULL REQUEST BODY:', JSON.stringify(req.body, null, 2));

    const { sections, exportOptions } = req.body;

    if (!sections || !Array.isArray(sections) || sections.length === 0) {
      console.error('No sections provided for PDF export');
      return res.status(400).json({ error: 'No sections provided' });
    }

    console.log(`Received ${sections.length} sections for PDF export`);
    console.log('Order of sections:', sections.map((s, idx) => 
      `${idx+1}. ${s.title || s.id || 'unnamed'} (${s.matter || 'unspecified'} matter)`).join('\n'));
    console.log('Export Options:', JSON.stringify(exportOptions || {}, null, 2));

    // --- Export limit logic ---
    const { sections: limitedSections, partial } = await enforceExportLimitOrSlice(req, res, sections);
    if (limitedSections.length === 0) {
      console.error('No sections left after export limit:', limitedSections);
      return res.status(400).json({ error: 'No sections left after export limit' });
    }

    try {
      // Extract metadata from the options
      const title = exportOptions?.metadata?.title || req.body.title || 'Untitled Document';
      const author = exportOptions?.metadata?.author || req.body.author || 'Anonymous';
      const subtitle = exportOptions?.metadata?.subtitle || req.body.subtitle || '';
      const isbn = exportOptions?.metadata?.isbn || exportOptions?.isbn || req.body.isbn || '';

      // Log the exact value of the numberedHeadings option received from frontend
      console.log('NUMBERING SETTINGS:');
      console.log('- numberedHeadings (original):', exportOptions?.numberedHeadings);
      console.log('- typeof numberedHeadings:', typeof exportOptions?.numberedHeadings);
      console.log('- Boolean check:', exportOptions?.numberedHeadings === true);

      // Force the setting to be explicitly boolean
      const numberedHeadingsSetting = exportOptions?.numberedHeadings === true;
      console.log('- Final setting:', numberedHeadingsSetting);

      // Prepare assembly options with strict boolean check
      const assemblyOptions = {
        useChapterPrefix: exportOptions?.useChapterPrefix !== false,
        chapterLabelFormat: exportOptions?.chapterLabelFormat || 'none', // Default to 'none' for no chapter labels
        format: 'pdf',
        noSeparatorPages: exportOptions?.noSeparatorPages === true,
        frontMatterContinuous: exportOptions?.frontMatterContinuous !== false,
        numberedHeadings: numberedHeadingsSetting, // Use our strictly checked value
        includeTitlePage: true,
        generateTitlePage: false,
        titlePageContent: exportOptions?.titlePageContent,
        includeToc: exportOptions?.includeToc !== false,
        useAutoChapterNumbers: exportOptions?.useAutoChapterNumbers === true, // Only for PDF
        tocDepth: exportOptions?.tocDepth || exportOptions?.bookOptions?.tocDepth || 3, // Pass tocDepth to assembler
        language: exportOptions?.language || 'en', // Pass language for TOC translation
        metadata: {
          title,
          subtitle,
          author,
          isbn
        }
      };

      // Preprocess all section content to convert legacy image syntax
      const validSections = limitedSections.map(section => ({
        ...section,
        content: convertLegacyImagesToPlaceholder(section.content || ''),
        title: section.title || 'Untitled Section'
      }));

      // Use assembleBookPdf to get proper page numbering with front/main matter
      console.log('Using assembleBookPdf for proper front/main matter page numbering');
      const markdown = assembleBookPdf(validSections, assemblyOptions);

      // Remove emojis from markdown before PDF export
      let cleanMarkdown = markdown;
      // Clean up LaTeX image includes to use only user-specified scale
      // cleanMarkdown = cleanLatexImageIncludes(cleanMarkdown); // <-- Remove this line
      // Do not add YAML metadata here; let assembleBookPdf handle it
      const processedMarkdown = cleanMarkdown;
      
      // Save debug copy
      saveDebugFile(processedMarkdown, 'standard_markdown.md');
      
      // Write raw and processed markdown to temp files for debugging
      const debugDir = path.join(__dirname, 'debug');
      if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir);
      }
      
      // Write original markdown
      fs.writeFileSync(path.join(debugDir, 'original.md'), markdown, 'utf8');
      
      // Write cleaned markdown
      fs.writeFileSync(path.join(debugDir, 'cleaned.md'), cleanMarkdown, 'utf8');
      
      // Write processed markdown with YAML
      fs.writeFileSync(path.join(debugDir, 'processed.md'), processedMarkdown, 'utf8');
      
      console.log('Debug files written to:', debugDir);
      
      // Write processed markdown to temp file
      const tempDir = path.join(__dirname, 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      const tempId = Date.now();
      const mdPath = path.join(tempDir, `input_${tempId}.md`);
      const pdfPath = path.join(tempDir, `output_${tempId}.pdf`);

      // Save a copy of the input markdown to the debug directory for inspection
      if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir, { recursive: true });
      }
      const debugMdPath = path.join(debugDir, `input_${tempId}.md`);
      fs.writeFileSync(debugMdPath, processedMarkdown, 'utf8');
      console.log(`Saved input markdown to debug directory: ${debugMdPath}`);

      // Also write directly to temp for Pandoc
      try {
        // Write the processed markdown to disk - exportPdf will handle image processing
        fs.writeFileSync(mdPath, processedMarkdown, 'utf8');  

        console.log(`PANDOC INPUT: Saved markdown for PDF processing to ${mdPath}`);
        
        // IMPORTANT: Also copy local uploaded images to temp directory
        const userId = exportOptions.userId || req.body.userId || 'defaultUser';
        const projectId = exportOptions.projectId || req.body.projectId || 'defaultProject';
        console.log(`[IMAGE COPY] Copying local uploaded images for userId: ${userId}, projectId: ${projectId}`);
        copyImagesForExport(finalMarkdown, userId, projectId, tempDir);
        console.log(`[IMAGE COPY] Image preparation completed for userId: ${userId}, projectId: ${projectId}`);
      } catch (err) {
        console.error('Error writing markdown file for PDF processing:', err);
        // Don't return here, continue with PDF generation
      }

      // Parse book size from exportOptions
      let papersize = exportOptions?.papersize || 'letter';
      if (exportOptions?.bookSize) {
        papersize = exportOptions.bookSize.replace(/\s+/g, ''); // e.g., '6x9'
      }
      
      // Use tocDepth from exportOptions if present
      const tocDepth = exportOptions?.tocDepth || exportOptions?.bookOptions?.tocDepth || 3;

      // Prepare PDF export options for the exportPdf module
      const pdfOptions = {
        // Basic metadata
        title: title,
        author: author,
        subtitle: subtitle,
        isbn: isbn,
        
        // Book format settings
        documentclass: exportOptions?.documentclass || 'book',
        papersize: papersize, // Already processed from exportOptions.bookSize
        fontsize: exportOptions?.fontsize || '12pt',
        margin: exportOptions?.margin || '1in',
        
        // Binding type
        bindingType: exportOptions?.bindingType || 'paperback',
        
        // Margin settings
        overrideMargins: exportOptions?.overrideMargins === true,
        marginSize: exportOptions?.marginSize || 'normal', // 'narrow', 'normal', 'wide'
        
        // Bleed settings
        includeBleed: exportOptions?.includeBleed === true,
        
        // Content structure settings
        numberedHeadings: numberedHeadingsSetting, // Use our strictly checked value
        useChapterPrefix: exportOptions?.useChapterPrefix !== false,
        chapterLabelFormat: exportOptions?.chapterLabelFormat || 'number', // 'number', 'text', 'none'
        useAutoChapterNumbers: exportOptions?.useAutoChapterNumbers === true, // New option for auto chapter numbering
        
        // Table of contents settings
        includeToc: exportOptions?.includeToc !== false,
        tocLevel: exportOptions?.tocLevel || 'main', // 'main', 'sections', 'subsections'
        
        // Page break settings
        noSeparatorPages: exportOptions?.noSeparatorPages !== false, // Default to true
        frontMatterContinuous: exportOptions?.frontMatterContinuous !== false, // Default to true
        
        // Line height if specified
        lineheight: exportOptions?.lineheight || null,
        
        // Custom content if provided
        titlePageContent: exportOptions?.titlePageContent,
        // FIXED: Pass the selected font family from the frontend
        fontFamily: exportOptions?.fontFamily || 'Liberation Serif',
      };
      
      console.log('Passing fontFamily to PDF export:', pdfOptions.fontFamily);

      // Print the markdown for debugging - add more detailed info about metadata
      const mdSample = processedMarkdown.substring(0, 500);
      console.log('===== MARKDOWN SAMPLE (first 500 chars) =====');
      console.log(mdSample);
      console.log('=====');

      // Check if there's metadata in the markdown
      const hasMetadata = mdSample.trim().startsWith('---');
      console.log('Has YAML metadata block:', hasMetadata);
      console.log('Title from options:', title);
      console.log('Author from options:', author);
      console.log('Subtitle from options:', subtitle);

      // Update how we set title page options to ensure it's enabled
      pdfOptions.includeTitle = true; // Explicitly enable title page
      pdfOptions.title = title;
      pdfOptions.author = author;
      pdfOptions.subtitle = subtitle;

      // If we're using a custom title page, make sure it's captured correctly
      if (exportOptions?.titlePageContent) {
        console.log('Using custom title page content');
        pdfOptions.titlePageContent = exportOptions.titlePageContent;
        // Extract sample of title page content
        console.log('Title page content sample:', exportOptions.titlePageContent.substring(0, 100));
      } else {
        console.log('Using auto-generated title page');
      }

      // Create Pandoc options for PDF export
      const pandocOptions = [
        '--pdf-engine=xelatex',
        '--template=templates/custom.tex',
        '--from=markdown+raw_tex+latex_macros',
      ];

      // Generate the PDF using our exportPdf module
      await exportPdf(mdPath, pdfPath, pdfOptions);

      // Serve the PDF file
      try {
        // Generate a unique file ID for tracking (include "pdf" in the ID)
        const fileId = `${req.user?.userId || 'anonymous'}_pdf_${Date.now()}`;
        
        // Add file to tracking system for cleanup
        tempExportFiles.set(fileId, pdfPath);
        console.log(`[PDF EXPORT] Stored file at ${pdfPath} with ID ${fileId}`);
        
        // Schedule automatic cleanup after 15 minutes
        setTimeout(() => {
          if (tempExportFiles.has(fileId)) {
            if (fs.existsSync(pdfPath)) {
              try {
                fs.unlinkSync(pdfPath);
                console.log(`Auto-deleted temporary PDF file after 15 minutes: ${pdfPath}`);
              } catch (err) {
                console.error(`Error deleting temporary PDF file: ${pdfPath}`, err);
              }
            }
            tempExportFiles.delete(fileId);
          }
        }, 15 * 60 * 1000); // 15 minutes
        
        // Return only the fileId, without any base64 data
        const response = {
          success: true,
          fileId,
          mimeType: 'application/pdf',
          fileName: path.basename(pdfPath)
        };
        console.log(`[PDF EXPORT] Sending response to client:`, response);
        res.json(response);
      } catch (err) {
        console.error('Error processing PDF file for download:', err);
        return res.status(500).json({ error: 'Failed to process PDF file for download' });
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      res.status(500).json({ error: 'Error generating PDF', details: error.message });
    }
  } catch (error) {
    console.error('Error in PDF export route:', error);
    res.status(500).json({ error: 'PDF export failed', details: error.message });
  }
});
/**
 * POST /export/epub
 * Expects: { sections: array, exportOptions: object }
 * Returns: EPUB file generated by Pandoc
 */
app.post('/export/epub', rateLimiting.export, authenticateJWT, async (req, res) => {
  // Log the full request body for debugging
  console.log('EPUB EXPORT REQUEST BODY:', JSON.stringify(req.body, null, 2));
  
  const { sections, exportOptions, title } = req.body;
  
  if (!sections || !Array.isArray(sections) || sections.length === 0) {
    console.error('No sections provided for EPUB export');
    return res.status(400).json({ error: 'No sections provided' });
  }
  
  console.log(`EPUB Export: Received ${sections.length} sections`);
  console.log(`EPUB Export options:`, exportOptions);
  
  // --- Export limit logic ---
  const { sections: limitedSections, partial } = await enforceExportLimitOrSlice(req, res, sections);
  if (limitedSections.length === 0) {
    console.error('No sections left after export limit:', limitedSections);
    return res.status(400).json({ error: 'No sections left after export limit' });
  }
  
  try {
    // Preprocess all section content to convert legacy image syntax
    const processedSections = limitedSections.map(section => ({
      ...section,
      content: convertLegacyImagesToPlaceholder(section.content || ''),
      title: section.title || 'Untitled Section'
    }));
    
    const assembledMarkdown = assembleBookEpub(processedSections, { 
      ...exportOptions,
      generateTitlePage: false
    });
    
    // Create temp files with better error handling
    let tempInputFile, tempOutputFile;
    
    tempInputFile = path.join(os.tmpdir(), `epub_input_${uuidv4()}.md`);
    tempOutputFile = path.join(os.tmpdir(), `epub_output_${uuidv4()}.epub`);
    
    console.log(`[EPUB EXPORT] Creating temp input file: ${tempInputFile}`);
    console.log(`[EPUB EXPORT] Target temp output file: ${tempOutputFile}`);
    
    try {
      fs.writeFileSync(tempInputFile, assembledMarkdown);
      console.log(`[EPUB EXPORT] Successfully wrote ${assembledMarkdown.length} characters to temp file`);
    } catch (tempFileError) {
      console.error('Error creating temp files:', tempFileError);
      return res.status(500).send('EPUB export failed: Cannot create temp files - ' + tempFileError.message);
    }
    
    // Define arguments for pandoc
    let args = [
      tempInputFile,
      '-o', tempOutputFile,
      '-f', 'markdown',
      '-t', 'epub',
      '--toc',
      '--standalone',
      '--top-level-division=chapter',
      `--variable=toc-title:${getTocTitle(exportOptions?.language || 'en')}`,
      '--toc-depth=2' // Always use depth 2 for EPUB
    ];

    // Add number-sections flag based on numberedHeadings setting
    if (exportOptions?.numberedHeadings) {
      args.push('--number-sections');
      console.log('Adding --number-sections flag for numbered headings');
    } else {
      console.log('Skipping --number-sections flag to disable numbered headings');
    }

    // Use the persistent epub-style.css file
    const cssFile = path.join(__dirname, 'epub-style.css');
    if (fs.existsSync(cssFile)) {
      args.push(`--css=${cssFile}`);
      console.log('Using persistent CSS file:', cssFile);
    } else {
      console.warn('CSS file not found, proceeding without custom styles:', cssFile);
    }

    // Add cover image if provided, or use default if not
    let coverPath = null;
    if (exportOptions?.coverImage) {
      coverPath = exportOptions.coverImage;
      // If the coverImage is just a filename (no path), resolve it to the uploads directory
      if (!path.isAbsolute(coverPath)) {
        coverPath = path.join(__dirname, 'uploads', coverPath);
      }
      // Don't add cover image here - will add after processing
    } else {
      // Use default cover image if none provided
      coverPath = path.join(__dirname, 'uploads', 'default_cover.png');
    }
    
    // Check file size (limit to 10 MB) and existence
    try {
      const stats = fs.statSync(coverPath);
      if (stats.size > 10 * 1024 * 1024) { // 10 MB
        return res.status(400).json({ error: 'Cover image exceeds 10 MB size limit.' });
      }
      // Copy the cover image to the temp directory with a unique name
      const coverExt = path.extname(coverPath);
      const coverTempPath = path.join(os.tmpdir(), `cover_${uuidv4()}${coverExt}`);
      fs.copyFileSync(coverPath, coverTempPath);
      
      // Add the cover image to args
      args.push('--epub-cover-image=' + coverTempPath);
      console.log('Using cover image:', coverTempPath);
    } catch (err) {
      console.error('Cover image file not found or inaccessible:', err);
      // If the default cover is also missing, skip adding a cover
    }

    // Log Pandoc version for backend diagnostics
    execFile(PANDOC_PATH, ['--version'], (err, stdout, stderr) => {
      if (err) {
        console.error('Error getting Pandoc version:', err);
      } else {
        console.log('Pandoc version (backend):', stdout.split('\n')[0]);
      }
    });

    // Log the Pandoc command for debugging
    console.log('Pandoc EPUB command:', args.join(' '));
    console.log('Using PANDOC_PATH:', PANDOC_PATH);

    // Check if Pandoc exists (skip check for system PATH commands like 'pandoc')
    const needsPathCheck = PANDOC_PATH !== 'pandoc' && 
                           !PANDOC_PATH.includes('pandoc.exe') && 
                           path.isAbsolute(PANDOC_PATH);
    
    if (needsPathCheck && !fs.existsSync(PANDOC_PATH)) {
      console.error('Pandoc not found at path:', PANDOC_PATH);
      console.error('Available environment variables:', process.env.PANDOC_PATH || 'PANDOC_PATH not set');
      
      // Try fallback to system pandoc
      const systemPandoc = process.platform === 'win32' ? 'pandoc' : 'pandoc';
      console.log('Falling back to system Pandoc:', systemPandoc);
      
      // Use system pandoc with original args
      execFile(systemPandoc, args, (err, stdout, stderr) => {
        if (err) {
          console.error('Pandoc EPUB error (system fallback):', err);
          console.error('Pandoc stderr:', stderr);
          console.error('Pandoc stdout:', stdout);
          
          // Cleanup temp input file on error
          if (tempInputFile && fs.existsSync(tempInputFile)) {
            try {
              fs.unlinkSync(tempInputFile);
              console.log('Cleaned up temp input file on fallback error');
            } catch (cleanupErr) {
              console.warn('Failed to cleanup temp input file:', cleanupErr.message);
            }
          }
          
          return res.status(500).send('EPUB generation failed: ' + err.message);
        }
        
        handleEpubSuccess();
      });
      return;
    }

    // Function to handle successful EPUB generation
    const handleEpubSuccess = () => {
      // Cleanup temp input file immediately after successful generation
      if (tempInputFile && fs.existsSync(tempInputFile)) {
        try {
          fs.unlinkSync(tempInputFile);
          console.log('[EPUB EXPORT] Cleaned up temp input file after successful generation');
        } catch (cleanupErr) {
          console.warn('Failed to cleanup temp input file:', cleanupErr.message);
        }
      }
      
      // Generate a unique file ID for tracking (include "epub" in the ID)
      const fileId = `${req.user?.userId || 'anonymous'}_epub_${Date.now()}`;
      
      // Add file to tracking system for cleanup
      tempExportFiles.set(fileId, tempOutputFile);
      console.log(`[EPUB EXPORT] Stored file at ${tempOutputFile} with ID ${fileId}`);
      
      // Schedule automatic cleanup after 15 minutes
      setTimeout(() => {
        if (tempExportFiles.has(fileId)) {
          if (fs.existsSync(tempOutputFile)) {
            try {
              fs.unlinkSync(tempOutputFile);
              console.log(`Auto-deleted temporary EPUB file after 15 minutes: ${tempOutputFile}`);
            } catch (err) {
              console.error(`Error deleting temporary EPUB file: ${tempOutputFile}`, err);
            }
          }
          tempExportFiles.delete(fileId);
        }
      }, 15 * 60 * 1000); // 15 minutes
      
      // Return only the fileId, without any base64 data
      const response = {
        success: true,
        fileId,
        mimeType: 'application/epub+zip',
        fileName: path.basename(tempOutputFile)
      };
      console.log(`[EPUB EXPORT] Sending response to client:`, response);
      res.json(response);
    };

    // Run Pandoc to generate EPUB
    execFile(PANDOC_PATH, args, (err, stdout, stderr) => {
      if (err) {
        console.error('Pandoc EPUB error:', err);
        console.error('Pandoc stderr:', stderr);
        console.error('Pandoc stdout:', stdout);
        
        // Cleanup temp input file on error
        if (tempInputFile && fs.existsSync(tempInputFile)) {
          try {
            fs.unlinkSync(tempInputFile);
            console.log('Cleaned up temp input file on main error');
          } catch (cleanupErr) {
            console.warn('Failed to cleanup temp input file:', cleanupErr.message);
          }
        }
        
        return res.status(500).send('EPUB generation failed: ' + err.message);
      }
      
      handleEpubSuccess();
    });
  } catch (err) {
    console.error('EPUB export error:', err);
    
    // Cleanup temp files on error
    if (tempInputFile && fs.existsSync(tempInputFile)) {
      try {
        fs.unlinkSync(tempInputFile);
        console.log('Cleaned up temp input file on error');
      } catch (cleanupErr) {
        console.warn('Failed to cleanup temp input file:', cleanupErr.message);
      }
    }
    if (tempOutputFile && fs.existsSync(tempOutputFile)) {
      try {
        fs.unlinkSync(tempOutputFile);
        console.log('Cleaned up temp output file on error');
      } catch (cleanupErr) {
        console.warn('Failed to cleanup temp output file:', cleanupErr.message);
      }
    }
    
    res.status(500).send('EPUB export failed: ' + err.message);
  }
});

/**
 * POST /export/docx
 * Expects: { sections: array, exportOptions: object }
 * Returns: DOCX file generated by Pandoc
 */
app.post('/export/docx', rateLimiting.export, authenticateJWT, async (req, res) => {
  // Log the full request body for debugging
  console.log('DOCX EXPORT REQUEST BODY:', JSON.stringify(req.body, null, 2));
  const { sections, exportOptions, title } = req.body;
  
  if (!sections || !Array.isArray(sections) || sections.length === 0) {
    return res.status(400).json({ error: 'No sections provided' });
  }
  
  // Log the order of sections received for debugging
  console.log('DOCX export section order:', sections.map((s, i) => `${i + 1}. ${s.title || s.id || '[no title]'}`));
  
  // Log the entire exportOptions object to see what's being received
  console.log('DOCX exportOptions received:', JSON.stringify(exportOptions, null, 2));
  
  // --- Export limit logic ---
  const { sections: limitedSections, partial } = await enforceExportLimitOrSlice(req, res, sections);
  if (limitedSections.length === 0) {
    console.error('No sections left after export limit:', limitedSections);
    return res.status(400).json({ error: 'No sections left after export limit' });
  }
  
  try {
    // Preprocess all section content to convert legacy image syntax
    const processedSections = limitedSections.map(section => ({
      ...section,
      content: convertLegacyImagesToPlaceholder(section.content || ''),
      title: section.title || 'Untitled Section'
    }));
    
    // Prepare options for book assembly with frontMatter continuous option
    const assemblyOptions = { 
      ...exportOptions,
      format: 'docx',
      // Ensure continuous sections in frontMatter (no page breaks between them)
      frontMatterContinuous: exportOptions?.frontMatterContinuous !== false,
      // Make sure noSeparatorPages is passed from the frontend options 
      noSeparatorPages: exportOptions?.noSeparatorPages === true,
      language: exportOptions?.language || 'en', // Pass language for TOC translation
    };
    
    // Assemble the book - sections order will be preserved in assembleBook
    const assembledMarkdown = assembleBookDocx(processedSections, assemblyOptions);
    console.log('Book assembled, preserving section order as shown above');

    // ONLY USE FRONTEND VALUES - frontend should always provide these as required fields
    const bookTitle = exportOptions?.projectTitle || title || 'Untitled Book';
    const author = exportOptions?.author || '';
    
    console.log('Using title from frontend:', bookTitle);
    console.log('Using author from frontend:', author);
    
    const subtitle = exportOptions?.subtitle || '';
    
    let metadataBlock = '---\n';
    metadataBlock += `title: "${bookTitle.replace(/"/g, '\"')}"\n`;
    metadataBlock += `author: "${author.replace(/"/g, '\"')}"\n`;
    if (subtitle) metadataBlock += `subtitle: "${subtitle.replace(/"/g, '\"')}"\n`;
    metadataBlock += `toc-title: "${getTocTitle(exportOptions?.language || 'en')}"\n`;
    metadataBlock += '---\n\n';

    // Prepend metadata block to assembledMarkdown
    const finalMarkdown = metadataBlock + assembledMarkdown;

    const timestamp = Date.now();
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }
    const mdPath = path.join(tempDir, `input_${timestamp}.md`); // [DEBUG] Save assembled markdown
    const docxPath = path.join(tempDir, `output_${timestamp}.docx`);

    // Modify the markdown to add explicit page breaks between sections
    // This helps ensure each section starts on a new page
    let processedMarkdown = finalMarkdown;
    
    // SANITIZE: Remove scale comments immediately after assembling (same as PDF export)
    console.log(`[DOCX EXPORT] Sanitizing scale comments...`);
    const beforeSanitize = processedMarkdown.length;
    processedMarkdown = processedMarkdown.replace(/<!--\s*scale:[^>]*-->/gi, '');
    processedMarkdown = processedMarkdown.replace(/&lt;!--\s*scale:[^&]*--&gt;/gi, '');
    processedMarkdown = processedMarkdown.replace(/<!-- scale:[^>]*-->/g, '');
    const afterSanitize = processedMarkdown.length;
    console.log(`[DOCX EXPORT] Scale comment sanitization removed ${beforeSanitize - afterSanitize} characters`);
    
    // Process the markdown to add section breaks
    // Replace h1 headers with page breaks before them (except the first one)
    let isFirstH1 = true;
    processedMarkdown = processedMarkdown.replace(/^# (.+)$/gm, (match, title) => {
      if (isFirstH1) {
        isFirstH1 = false;
        return match; // Don't add page break before the first h1 (title page)
      }
      return `\n\n<div style="page-break-before: always;"></div>\n\n# ${title}`;
    });
    
    // Add page break between title page and TOC
    processedMarkdown = processedMarkdown.replace(/^(---\s*\n[\s\S]*?\n---\s*\n\n)/, '$1\n\n<div style="page-break-before: always;"></div>\n\n');
    
    // [DEBUG] Save the processed markdown for inspection
    try {
      fs.writeFileSync(mdPath, processedMarkdown);
      console.log(`[DEBUG] Saved processed markdown to ${mdPath}`);
    } catch (err) {
      console.error('[DEBUG] Error saving processed markdown:', err);
      return res.status(500).send('Error saving markdown file');
    }

    // Use the title from exportOptions for the output file
    const projectTitle = bookTitle;
    
    // Calculate the correct TOC depth based on tocLevel
    // Default to 2 if not specified for backward compatibility
    const tocDepth = exportOptions?.tocDepth || 
                    (exportOptions?.tocLevel === 'h1' ? 1 : 
                     exportOptions?.tocLevel === 'h3' ? 3 : 2);
    
    console.log(`Using TOC depth: ${tocDepth} (from tocLevel: ${exportOptions?.tocLevel || 'not specified'})`);
    
    let pandocArgs = [
      mdPath,
      '-o', docxPath,
      '--toc',
      `--toc-depth=${tocDepth}`,
      '-V', `toc-title=${getTocTitle(exportOptions?.language || 'en')}`,
      // Add section page breaks
    ];
    // Use a reference.docx to map .center divs to the 'center' style in Word
    let referenceDocPath = path.join(__dirname, 'templates', 'reference.docx');
    if (exportOptions?.bookSize) {
      const refBySize = path.join(__dirname, 'templates', `reference-${exportOptions.bookSize}.docx`);
      if (fs.existsSync(refBySize)) {
        referenceDocPath = refBySize;
        console.log(`Using reference doc for size ${exportOptions.bookSize}: ${referenceDocPath}`);
      }
    }
    if (fs.existsSync(referenceDocPath)) {
      pandocArgs.push('--reference-doc=' + referenceDocPath);
    } else {
      console.warn('No suitable reference.docx found; .center/.right styles may not be mapped in DOCX export.');
    }

    // Add number-sections flag if numberedHeadings is enabled
    if (exportOptions?.numberedHeadings) {
      pandocArgs.push('--number-sections');
      console.log('Adding --number-sections flag for numbered headings');
    }

    // Modify the content to ensure sections begin on new pages
    // Find the title page created by the user (not system-generated)
    const userTitlePage = sections.find(s => s.isTitlePage || 
                                           s.id === 'front:Title Page' || 
                                           s.title?.toLowerCase() === 'title page');
    
    // Log whether we found a user title page
    console.log('User title page found:', userTitlePage ? 'YES' : 'NO');
    if (userTitlePage) {
      console.log('User title page ID:', userTitlePage.id);
    } else {
      console.log('No user title page found - using standard layout');
    }
    
    // Set explicit flags to disable system-generated title page
    pandocArgs.push('--variable=disable-auto-title:true');
    
    // Create a variable to flag if this is a title page only document (just for debugging)
    const isTitlePageOnly = sections.length === 1 && sections[0].isTitlePage;
    console.log('Is title page only document:', isTitlePageOnly ? 'YES' : 'NO');

    // Log Pandoc version for backend diagnostics
    execFile(PANDOC_PATH, ['--version'], (err, stdout, stderr) => {
      if (err) {
        console.error('Error getting Pandoc version:', err);
      } else {
        console.log('Pandoc version (backend):', stdout.split('\n')[0]);
      }
    });

    // Log the Pandoc command for debugging
    console.log('Pandoc DOCX command:', [PANDOC_PATH, ...pandocArgs].join(' '));

    // Run Pandoc to generate DOCX
    execFile(PANDOC_PATH, pandocArgs, (err) => {
      if (err) {
        console.error('Pandoc DOCX error:', err);
        return res.status(500).send('DOCX generation failed');
      }
      
      // Generate a unique file ID for tracking (include "word" in the ID)
      const fileId = `${req.user?.userId || 'anonymous'}_word_${Date.now()}`;
      
      // Add file to tracking system for cleanup
      tempExportFiles.set(fileId, docxPath);
      console.log(`[DOCX EXPORT] Stored file at ${docxPath} with ID ${fileId}`);
      
      // Schedule automatic cleanup after 15 minutes
      setTimeout(() => {
        if (tempExportFiles.has(fileId)) {
          if (fs.existsSync(docxPath)) {
            try {
              fs.unlinkSync(docxPath);
              console.log(`Auto-deleted temporary DOCX file after 15 minutes: ${docxPath}`);
            } catch (err) {
              console.error(`Error deleting temporary DOCX file: ${docxPath}`, err);
            }
          }
          tempExportFiles.delete(fileId);
        }
      }, 15 * 60 * 1000); // 15 minutes
      
      // Return only the fileId, without any base64 data
      const response = {
        success: true,
        fileId,
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        fileName: path.basename(docxPath)
      };
      console.log(`[DOCX EXPORT] Sending response to client:`, response);
      res.json(response);
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('DOCX export failed: ' + err.message);
  }
});

/**
 * GET /debug/epub
 * Simple test endpoint that returns a small test EPUB file
 */
app.get('/debug/epub', async (req, res) => {
  const epubPath = path.join(__dirname, 'test.epub');
  console.log("DEBUG EPUB endpoint called");
  
  try {
    // Generate a simple test EPUB
    const options = {
      title: 'Test Book',
      author: 'Debug System',
      content: [{
        title: 'Test Chapter',
        data: '<p>This is a test EPUB file to diagnose download issues.</p>'
      }],
      css: 'body { font-family: Arial, sans-serif; }',
      tocTitle: 'Contents',
      publisher: 'Debug Publisher',
      lang: 'en'
    };
    
    await new Epub(options, epubPath).promise;
    console.log("Test EPUB file created");
    
    // Set explicit headers
    res.setHeader('Content-Type', 'application/epub+zip');
    res.setHeader('Content-Disposition', 'attachment; filename="test.epub"');
    
    // Send the file
    res.download(epubPath, 'test.epub', (err) => {
      if (err) {
        console.error('Download error:', err);
      }
      // Clean up
      try {
        if (fs.existsSync(epubPath)) {
          fs.unlinkSync(epubPath);
        }
      } catch (err) {
        console.error('Error deleting test file:', err);
      }
    });
  } catch (error) {
    console.error('Error creating test EPUB:', error);
    res.status(500).send('Error creating test EPUB: ' + error.message);
  }
});

/**
 * Parse book size string to extract width and height measurements
 * Handles formats like "6inx9in", "6x9", "5.5x8.5in", etc.
 */
function parseBookSize(sizeString) {
  console.log("Processing book size from frontend:", sizeString);
  
  // Handle KDP-style sizes with or without "in" suffix
  // Example formats: "6inx9in", "5.5inx8.5in", "8.5inx11in"
  const withUnitsRegex = /^([\d.]+)in(?:ch)?x([\d.]+)in(?:ch)?$/i;
  const withoutUnitsRegex = /^([\d.]+)x([\d.]+)$/;
  
  let width, height;
  
  // Try with units format first (e.g., "6inx9in")
  const matchWithUnits = sizeString.match(withUnitsRegex);
  if (matchWithUnits) {
    width = parseFloat(matchWithUnits[1]);
    height = parseFloat(matchWithUnits[2]);
    console.log(`Parsed size with units: ${width}in x ${height}in`);
    return { width, height };
  }
  
  // Try without units format (e.g., "6x9")
  const matchWithoutUnits = sizeString.match(withoutUnitsRegex);
  if (matchWithoutUnits) {
    width = parseFloat(matchWithoutUnits[1]);
    height = parseFloat(matchWithoutUnits[2]);
    console.log(`Parsed size without units: ${width}in x ${height}in`);
    return { width, height };
  }
  
  // Handle standard size strings
  const standardSizes = {
    '6x9': { width: 6, height: 9 },
    '5x8': { width: 5, height: 8 },
    '5.06x7.81': { width: 5.06, height: 7.81 },
    '5.25x8': { width: 5.25, height: 8 },
    '5.5x8.5': { width: 5.5, height: 8.5 },
    '6.14x9.21': { width: 6.14, height: 9.21 },
    '6.69x9.61': { width: 6.69, height: 9.61 },
    '7x10': { width: 7, height: 10 },
    '7.44x9.69': { width: 7.44, height: 9.69 },
    '7.5x9.25': { width: 7.5, height: 9.25 },
    '8x10': { width: 8, height: 10 },
    '8.25x6': { width: 8.25, height: 6 },
    '8.25x8.25': { width: 8.25, height: 8.25 },
    '8.5x8.5': { width: 8.5, height: 8.5 },
    '8.5x11': { width: 8.5, height: 11 },
    '8.25x11': { width: 8.25, height: 11 },
    '8.27x11.69': { width: 8.27, height: 11.69 },
    'A4': { width: 8.27, height: 11.69 },
    'A5': { width: 5.83, height: 8.27 },
    'letter': { width: 8.5, height: 11 },
  };
  
  if (standardSizes[sizeString]) {
    console.log(`Found standard size: ${sizeString} → ${standardSizes[sizeString].width}in x ${standardSizes[sizeString].height}in`);
    return standardSizes[sizeString];
  }
  
  // Last resort: Extract numbers from string
  const numbers = sizeString.match(/[\d.]+/g);
  if (numbers && numbers.length >= 2) {
    width = parseFloat(numbers[0]);
    height = parseFloat(numbers[1]);
    console.log(`Extracted numbers from string: ${width}in x ${height}in`);
    return { width, height };
  }
  
  // Default to 6x9 if nothing else works
  console.log("WARNING: Could not parse book size, defaulting to 6x9");
  return { width: 6, height: 9 };
}

/**
 * Process markdown to ensure it has proper structure for book formatting
 * Ensures proper book structure:
 * 1. First heading is always preserved as plain text (book title)
 * 2. Front Matter: Only recognized sections are unnumbered chapters
 * 3. Main Matter: Contains all numbered chapters (starting at Chapter 1)
 */
function processMarkdown(markdown) {
  // If the markdown is the special no-content message, return as-is
  if (markdown.trim().startsWith('# No Content')) {
    return markdown.trim();
  }

  // If the markdown already contains \chapter*{Acknowledgements}, skip adding it again
  if (/\\chapter\*\{Acknowledgements\}/i.test(markdown)) {
    return markdown.trim();
  }
  
  // Fix excessive vertical spacing from multiple blank lines
  markdown = markdown.replace(/\n{3,}/g, '\n\n');
  
  // For title-only documents, just return the markdown without processing
  const titleCheckLines = markdown.split('\n').filter(line => line.trim() !== '');
  const hasOnlyOneHeading = titleCheckLines.filter(line => line.startsWith('#')).length <= 1;
  const hasFewLines = titleCheckLines.length <= 5; // Allow for title, author, blank lines
  
  if (hasOnlyOneHeading && hasFewLines) {
    console.log("Title-only document detected in processMarkdown, returning as-is");
    return markdown.trim();
  }

  console.log("Processing markdown...");

  const lines = markdown.split('\n');
  const processedLines = [];
  let inFrontMatter = true;
  let addedMainmatter = false;
  
  // Extract TOC depth setting from YAML
  let tocDepth = 3; // Default depth
  let tocEnabled = false;

  // Front matter section names to recognize
  const frontMatterSections = [
    'dedication', 'acknowledgments', 'acknowledgements', 'preface',
    'foreword', 'introduction', 'copyright', 'about', 'contents',
    'disclaimer', 'author'
  ];

  // Process YAML metadata block if present
  let i = 0;
  if (lines.length > 2 && lines[0].trim() === '---') {
    processedLines.push(lines[0]);
    i++;
    
    // Parse YAML block for TOC settings
    while (i < lines.length && lines[i].trim() !== '---') {
      const line = lines[i].trim();
      processedLines.push(lines[i]);
      
      // Extract TOC settings
      if (line.startsWith('toc:')) {
        tocEnabled = line.substring(4).trim() === 'true';
      } else if (line.startsWith('toc-depth:')) {
        const depthStr = line.substring(10).trim();
        const depth = parseInt(depthStr);
        if (!isNaN(depth) && depth >= 1 && depth <= 6) {
          tocDepth = depth;
        }
      }
      
      i++;
    }
    
    if (i < lines.length) {
      processedLines.push(lines[i]);
      i++;
    }
  }

  // Start front matter
  processedLines.push('\n\\frontmatter\n');

  let firstHeadingSeen = false;
  let mainMatterIndex = -1;
  let firstRealChapterIndex = -1;

  // Find where main matter should begin
  for (let j = i; j < lines.length; j++) {
    const line = lines[j].trim();

    // Explicit Main Matter marker
    if (line === '# Main Matter' || line === '## Main Matter') {
      mainMatterIndex = j;
      break;
    }

    // First # heading that is NOT a known front matter section
    if (line.startsWith('# ')) {
      const title = line.substring(2).trim().toLowerCase();
      if (!firstHeadingSeen) {
        firstHeadingSeen = true;
        continue; // Treat first heading as title page, not a chapter
      }
      const isFrontMatter = frontMatterSections.some(section => title === section);
      if (!isFrontMatter) {
        mainMatterIndex = j;
        break;
      }
      if (firstRealChapterIndex === -1) {
        firstRealChapterIndex = j;
      }
    }
  }
  if (mainMatterIndex === -1 && firstRealChapterIndex !== -1) {
    mainMatterIndex = firstRealChapterIndex;
  }

  firstHeadingSeen = false;
  
  // Process all lines
  for (let j = i; j < lines.length; j++) {
    // If we've reached main matter point, switch mode
    if (j === mainMatterIndex) {
      // Main matter is handled by the LaTeX template
      inFrontMatter = false;
      addedMainmatter = true;
      continue;
    }

    const line = lines[j];

    // In front matter, treat first heading as title page (plain text)
    if (inFrontMatter && line.trim().startsWith('#')) {
      const match = line.trim().match(/^(#+)\s+(.+)$/);
      if (match) {
        const title = match[2];
        if (!firstHeadingSeen) {
          processedLines.push(title); // Just plain text for the title
          firstHeadingSeen = true;
        } else {
          // Only convert known front matter sections to unnumbered chapters (exact match)
          const isFrontMatter = frontMatterSections.some(section => title.trim().toLowerCase() === section);
          if (isFrontMatter) {
            processedLines.push(`\\chapter*{${title}}`);
            processedLines.push(`\\addcontentsline{toc}{chapter}{${title}}`);
            processedLines.push(`\\markboth{${title}}{}`);
            processedLines.push('\\thispagestyle{frontmatter}');
            processedLines.push('\\clearpage');
          } else {
            processedLines.push(title); // Just plain text
          }
        }
      } else {
        processedLines.push(line);
      }
    } else {
      // In main matter, keep headings as-is
      processedLines.push(line);
    }
  }

  // Main matter is handled by the LaTeX template

  const result = processedLines.join('\n');
  console.log("Processed Markdown Sample (first 500 chars):");
  console.log(result.substring(0, 500));
  console.log("...");
  console.log("Main Matter begins at line:", mainMatterIndex);
  console.log("TOC settings - enabled:", tocEnabled, "depth:", tocDepth);

  return result;
}

function convertTopLevelHeadingToChapterStar(md) {
  // Replace a single top-level heading at the start with \chapter*{...}
  return md.replace(/^\s*#\s+(.+?)\s*\n/, '\\chapter*{$1}\n');
}

function renderSections(sections, area) {
  return sections.map((item, idx) => {
    let sectionMd = item.content;
    
    // For main matter, we need to ensure proper chapter/section hierarchy
    if (area === 'main') {
      // 1. Convert top-level headings to chapters
      // First check if there's a level 1 heading already
      const hasChapter = /^\s*#\s+(.+?)$/m.test(sectionMd);
      
      if (hasChapter) {
        // Convert any H1 to chapter and any H2 to section
        sectionMd = sectionMd
          // Convert # Heading to \chapter{Heading} for proper chapter structure
          .replace(/^\s*#\s+(.+?)$/gm, '\\chapter{$1}')
          // Convert ## Heading to \section{Heading} for proper section designation
          .replace(/^\s*##\s+(.+?)$/gm, '\\section{$1}');
      } else {
        // If no H1, add chapter automatically
        sectionMd = `\\chapter{${item.section}}\n` + sectionMd;
      }
    } 
    // For front matter, ensure proper unnumbered chapter structure
    else if (area === 'front' || area === 'back') {
      // Convert any H1 to unnumbered chapter
      sectionMd = sectionMd
        // Convert # Heading to \chapter*{Heading} for unnumbered chapters
        .replace(/^\s*#\s+(.+?)$/gm, '\\chapter*{$1}\\addcontentsline{toc}{chapter}{$1}')
        // Convert ## Heading to \section*{Heading} for proper section designation
        .replace(/^\s*##\s+(.+?)$/gm, '\\section*{$1}');
        
      // If no chapter heading found, add one
      if (!(/\\chapter\*\{/.test(sectionMd))) {
        sectionMd = `\\chapter*{${item.section}}\\addcontentsline{toc}{chapter}{${item.section}}\n` + sectionMd;
      }
    }
    
    // Only add a page break if not the last section in this group
    if (idx < sections.length - 1) {
      sectionMd += '\n\n\\clearpage\n';
    }
    
    return sectionMd;
  }).join('');
}

/**
 * Process markdown for PDF export, with advanced document structure handling
 */
function processPdfMarkdown(markdown, tocDepth, options = {}) {
  // If the markdown is the special no-content message, return as-is
  if (markdown.trim() === "No content available.") {
    return markdown;
  }
  
  const {
    includeTitlePage = true,
    useChapterPrefix = true,
    chapterLabelFormat = 'number',
    noSeparatorPages = true,
    titlePageContent = null,
    projectTitle = '',
    forceTitleFirst = true
  } = options;
  
  // Check if there are any structural commands in the document already
  const hasExplicitStructure = markdown.includes('\\frontmatter') || 
                              markdown.includes('\\mainmatter') || 
                              markdown.includes('\\backmatter');
  
  // Start with an empty result
  let result = '';
  
  // Extract any metadata if present
  const metadataMatch = markdown.match(/^---\n([\s\S]*?)\n---\n/);
  let metadata = '';
  let content = markdown;
  
  if (metadataMatch) {
    metadata = metadataMatch[0];
    content = markdown.slice(metadata.length);
  } else {
    // If no metadata block exists, add one with minimal settings
    metadata = '---\ntitle: ' + (projectTitle || 'Untitled Document') + '\n---\n\n';
  }
  
  // Start with content only - Pandoc will apply the template
  result = content;
  
  // Log the document structure
  console.log("Processed Document Structure:");
  console.log("- Has explicit structure:", hasExplicitStructure);
  console.log("- Include title page:", includeTitlePage);
  console.log("- Project title:", projectTitle);
  console.log("- Content length:", result.length);
  
  // Ensure there's at least some content
  if (result.trim().length === 0) {
    result = "# " + (projectTitle || "Untitled Document") + "\n\nThis document has no content.";
    console.log("Generated default content for empty document");
  }
  
  return result;
}

// Start the server
app.listen(3002, () => console.log('Export server running on port 3002'));

/**
 * GET /health
 * Health check endpoint for the frontend to verify server availability
 */
app.get('/health', rateLimiting.healthCheck, (req, res) => {
  res.status(200).send({ status: 'ok', message: 'Export server is healthy' });
});

/**
 * GET /debug/environment
 * Environment debug endpoint for production debugging
 */
app.get('/debug/environment', (req, res) => {
  const envInfo = {
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    cwd: process.cwd(),
    tmpDir: os.tmpdir(),
    pandocPath: PANDOC_PATH,
    pandocPathExists: PANDOC_PATH === 'pandoc' ? 'System PATH command - cannot check' : fs.existsSync(PANDOC_PATH),
    env: {
      NODE_ENV: process.env.NODE_ENV,
      PANDOC_PATH: process.env.PANDOC_PATH || 'Not set - using platform default'
    }
  };
  
  // Check for alternative pandoc paths
  const pandocFallbacks = process.platform === 'win32' 
    ? ['pandoc', 'pandoc.exe'] 
    : ['/usr/bin/pandoc', '/usr/local/bin/pandoc', 'pandoc'];
  envInfo.pandocFallbacks = {};
  
  pandocFallbacks.forEach(fallbackPath => {
    if (fallbackPath === 'pandoc' || fallbackPath === 'pandoc.exe') {
      envInfo.pandocFallbacks[fallbackPath] = 'System PATH command - cannot check';
    } else {
      envInfo.pandocFallbacks[fallbackPath] = fs.existsSync(fallbackPath);
    }
  });
  
  // Check if CSS file exists
  const cssFile = path.join(__dirname, 'epub-style.css');
  envInfo.cssFileExists = fs.existsSync(cssFile);
  envInfo.cssFilePath = cssFile;
  
  res.json(envInfo);
});

/**
 * GET /ping
 * Simple endpoint to check if the server is running
 */
app.get('/ping', (req, res) => {
  res.send({ status: 'ok', message: 'Export server is running' });
});

app.post('/export', rateLimiting.export, authenticateJWT, async (req, res) => {
  try {
    const { numberedHeadings, sectionOrder, sectionFiles } = req.body;
    // sectionOrder: ['TITLE_PAGE', 'TOC', 'SECTION_1', ...]
    // sectionFiles: { TITLE_PAGE: '...', SECTION_1: '...', ... } (markdown content)

    // --- Export limit logic ---
    const { sections: limitedSections, partial } = await enforceExportLimitOrSlice(req, res, sectionOrder.map(key => ({ content: sectionFiles[key] || '' })));
    if (limitedSections.length === 0) {
      console.error('No sections left after export limit:', limitedSections);
      return res.status(400).json({ error: 'No sections left after export limit' });
    }

    // Write section files to disk (optional, for debugging)
    const sectionDir = path.join(__dirname, 'section-files');
    if (!fs.existsSync(sectionDir)) fs.mkdirSync(sectionDir);
    for (const [key, content] of Object.entries(sectionFiles)) {
      fs.writeFileSync(path.join(sectionDir, `${key.toLowerCase()}.md`), content, 'utf8');
    }

    // Build sectionMap for assembler
    const sectionMap = {};
    for (const key of sectionOrder) {
      sectionMap[key] = sectionFiles[key] || '';
    }

    // Assemble the book
    const assembled = assembleBook(
      path.join(__dirname, 'master.md'),
      sectionMap,
      numberedHeadings
    );
    const assembledPath = path.join(__dirname, 'final-assembled.md');
    fs.writeFileSync(assembledPath, assembled);
    console.log('Wrote assembled markdown to:', assembledPath);
    console.log('--- Assembled Markdown Preview ---');
    console.log(assembled.split('\n').slice(0, 30).join('\n'));
    console.log('--- END Preview ---');

    // Export with Pandoc
    const outputPath = path.join(__dirname, 'final.pdf');
    exportBook(
      assembledPath,
      outputPath,
      path.join(__dirname, 'book-template.tex'),
      numberedHeadings
    );

    // Send the PDF
    res.download(outputPath, 'book.pdf');
  } catch (err) {
    console.error(err);
    res.status(500).send('Export failed: ' + err.message);
  }
});

app.post('/export-epub', rateLimiting.export, authenticateJWT, async (req, res) => {
  try {
    const { numberedHeadings, sectionOrder, sectionFiles, title, author } = req.body;
    // sectionOrder: ['TITLE_PAGE', 'TOC', 'SECTION_1', ...]
    // sectionFiles: { TITLE_PAGE: '...', SECTION_1: '...', ... } (markdown content)

    // --- Export limit logic ---
    const { sections: limitedSections, partial } = await enforceExportLimitOrSlice(req, res, sectionOrder.map(key => ({ content: sectionFiles[key] || '' })));
    if (limitedSections.length === 0) {
      console.error('No sections left after export limit:', limitedSections);
      return res.status(400).json({ error: 'No sections left after export limit' });
    }

    // Write section files to disk (optional, for debugging)
    const sectionDir = path.join(__dirname, 'section-files');
    if (!fs.existsSync(sectionDir)) fs.mkdirSync(sectionDir);
    for (const [key, content] of Object.entries(sectionFiles)) {
      fs.writeFileSync(path.join(sectionDir, `${key.toLowerCase()}.md`), content, 'utf8');
    }

    // Build sectionMap for assembler
    const sectionMap = {};
    for (const key of sectionOrder) {
      sectionMap[key] = sectionFiles[key] || '';
    }

    // Assemble the book
    const assembled = assembleBookEpub(
      path.join(__dirname, 'master.md'),
      sectionMap,
      numberedHeadings
    );
    const assembledPath = path.join(__dirname, 'final-assembled.md');
    fs.writeFileSync(assembledPath, assembled);
    console.log('Wrote assembled markdown to:', assembledPath);
    console.log('--- Assembled Markdown Preview ---');
    console.log(assembled.split('\n').slice(0, 30).join('\n'));
    console.log('--- END Preview ---');

    // Export with Pandoc (EPUB)
    const outputPath = path.join(__dirname, 'final.epub');
    exportEpub(
      assembledPath,
      outputPath,
      { title, author, tocDepth: 2, language: exportOptions?.language || 'en' }
    );

    // Send the EPUB
    res.download(outputPath, 'book.epub', (err) => {
      // try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath); } catch (cleanupErr) { console.error('Error deleting EPUB file:', cleanupErr); }
      // [DEBUG] EPUB file is not deleted after download for debugging purposes. Revert this in production.
      if (err) console.error('Download error:', err);
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('EPUB export failed: ' + err.message);
  }
});

/**
 * POST /upload-cover
 * Handles cover image uploads for book exports
 * Accepts: multipart/form-data with a single image file (jpg, jpeg, png)
 * Returns: { success: boolean, filePath: string, message: string }
 */
app.post('/upload-cover', coverUpload.single('cover'), async (req, res) => {
  try {
    // Check if a file was uploaded
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Validate file type (allow only jpg, jpeg, png)
    const allowedMimeTypes = ['image/jpeg', 'image/png'];
    const allowedExtensions = ['.jpg', '.jpeg', '.png'];
    const fileExt = path.extname(req.file.originalname).toLowerCase();
    if (!allowedMimeTypes.includes(req.file.mimetype) || !allowedExtensions.includes(fileExt)) {
      // Delete the uploaded file if not valid
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: `Unsupported file type. Only JPG and PNG are allowed. Received: ${req.file.originalname} (${req.file.mimetype})` });
    }

    // Optionally, you could return a URL if serving static files
    // For now, return the file path relative to the uploads directory
    return res.json({
      success: true,
      filePath: req.file.path,
      message: 'Cover image uploaded successfully.'
    });
  } catch (error) {
    console.error('Cover upload error:', error);
    return res.status(500).json({
      error: 'Cover image upload failed',
      details: error.message
    });
  }
});

/**
 * Process markdown to add Chapter X headings and demote existing headings
 * @param {string} markdown - The markdown content to process
 * @returns {string} - The processed markdown with chapter headings
 */
function addChapterNumbersToHeadings(markdown) {
  console.log('Starting chapter numbering process');
  
  // Split the markdown into lines
  const lines = markdown.split('\n');
  const result = [];
  let chapterCount = 0;
  
  // Check for YAML front matter and preserve it
  let i = 0;
  let inFrontMatter = false;
  
  // Skip and preserve LaTeX commands like \frontmatter and \mainmatter
  while (i < lines.length) {
    const line = lines[i].trim();
    
    // Pass through LaTeX commands
    if (line.startsWith('\\')) {
      result.push(lines[i]);
      i++;
      continue;
    }
    
    // Check for level 1 heading
    if (/^# [^#]/.test(line)) {
      // Increment chapter count
      chapterCount++;
      console.log(`Found heading: "${line}", creating Chapter ${chapterCount}`);
      
      // Add a blank line before new chapter heading (if not at the beginning)
      if (result.length > 0) {
        result.push('');
      }
      
      // Add the chapter heading
      result.push(`# Chapter ${chapterCount}`);
      
      // Add the original heading, but demoted to level 2
      result.push(line.replace(/^# /, '## '));
    } else {
      // Keep other lines unchanged
      result.push(lines[i]);
    }
    
    i++;
  }
  
  console.log(`Chapter numbering complete. Found ${chapterCount} chapters.`);
  
  // Join the lines back together with newlines
  return result.join('\n');
}

/**
 * POST /test/chapter-numbering
 * Simple test endpoint for the chapter numbering feature
 */
app.post('/test/chapter-numbering', (req, res) => {
  try {
    const { markdown } = req.body;
    
    if (!markdown) {
      return res.status(400).json({ error: 'No markdown content provided' });
    }
    
    console.log('Testing chapter numbering on input markdown');
    const result = addChapterNumbersToHeadings(markdown);
    
    // Save the result for inspection using our helper function
    saveDebugFile(markdown, 'test_input.md');
    saveDebugFile(result, 'test_output.md');
    
    // Also save to temp directory
    saveDebugFile(markdown, `test_input_${Date.now()}.md`, 'temp');
    saveDebugFile(result, `test_output_${Date.now()}.md`, 'temp');
    
    return res.json({
      success: true,
      originalLength: markdown.length,
      resultLength: result.length,
      original: markdown.substring(0, 300) + '...',
      result: result.substring(0, 300) + '...',
      message: 'Test completed successfully. Check debug directory for full files.'
    });
  } catch (error) {
    console.error('Chapter numbering test error:', error);
    return res.status(500).json({
      error: 'Test failed',
      details: error.message
    });
  }
});

/**
 * GET /test/save-file
 * Simple test endpoint that creates a test file in both temp and debug directories
 */
app.get('/test/save-file', (req, res) => {
  console.log('TEST: File saving test endpoint called');
  
  try {
    // Test content
    const testContent = `# Test Heading
    
This is a test file created at ${new Date().toISOString()}

## A second level heading
Some more content

# Another top level heading
This should become a chapter in the numbering process.`;

    // Test saving directly to both directories
    const debugDir = path.join(__dirname, 'debug');
    const tempDir = path.join(__dirname, 'temp');
    
    // Create directories if they don't exist
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Direct file writing
    const debugPath = path.join(debugDir, 'direct_test.md');
    const tempPath = path.join(tempDir, 'direct_test.md');
    
    fs.writeFileSync(debugPath, testContent, 'utf8');
    fs.writeFileSync(tempPath, testContent, 'utf8');
    
    // Process the content with chapter numbering
    const processed = addChapterNumbersToHeadings(testContent);
    
    // Save the processed version too
    fs.writeFileSync(path.join(debugDir, 'direct_test_processed.md'), processed, 'utf8');
    fs.writeFileSync(path.join(tempDir, 'direct_test_processed.md'), processed, 'utf8');
    
    // Return success with paths
    res.json({
      success: true,
      debugPath: debugPath,
      tempPath: tempPath,
      debugDir: debugDir,
      tempDir: tempDir,
      message: 'Test files created successfully'
    });
  } catch (error) {
    console.error('TEST ERROR:', error);
    res.status(500).json({
      error: 'Failed to save test files',
      details: error.message,
      stack: error.stack
    });
  }
});

/**
 * GET /test/pdf-with-chapters
 * Simple test endpoint that creates a PDF with auto chapter numbering
 */
app.get('/test/pdf-with-chapters', (req, res) => {
  console.log('TEST: PDF with chapters test endpoint called');
  
  try {
    // Test content with multiple headings
    const testContent = `# First Heading
    
This is test content for the first section.

## A subsection 
Some detailed content.

# Second Heading
This is content for the second section.

# Third Heading
This is content for the third section.

## Another subsection
More content here.`;

    // Create a mock request body similar to what your frontend would send
    const mockRequestBody = {
      sections: [
        {
          id: 'section1',
          title: 'Test Document',
          content: testContent
        }
      ],
      exportOptions: {
        useAutoChapterNumbers: true,
        metadata: {
          title: 'Test PDF with Chapters',
          author: 'Test System'
        }
      }
    };
    
    // Save the test content for reference
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const testPath = path.join(tempDir, 'pdf_test_input.md');
    fs.writeFileSync(testPath, testContent, 'utf8');
    
    // Process the content directly using our chapter numbering function
    const numbered = addChapterNumbersToHeadings(testContent);
    fs.writeFileSync(path.join(tempDir, 'pdf_test_numbered.md'), numbered, 'utf8');
    
    // Now run the same flow as the PDF export endpoint
    console.log('TEST: Using assembleBookPlain');
    const markdown = assembleBookPlain(mockRequestBody.sections, {});
    
    console.log('TEST: Cleaning markdown');
    const cleanMarkdown = markdown;
    
    console.log('TEST: Adding YAML metadata');
    const yamlMetadata = `---
title: "Test PDF with Chapters"
author: "Test System"
---

`;
    
    console.log('TEST: Adding chapter numbers');
    const numberedMarkdown = addChapterNumbersToHeadings(cleanMarkdown);
    const processedMarkdown = yamlMetadata + numberedMarkdown;
    
    // Save all versions
    fs.writeFileSync(path.join(tempDir, 'pdf_test_assembled.md'), markdown, 'utf8');
    fs.writeFileSync(path.join(tempDir, 'pdf_test_cleaned.md'), cleanMarkdown, 'utf8');
    fs.writeFileSync(path.join(tempDir, 'pdf_test_numbered_with_yaml.md'), processedMarkdown, 'utf8');
    
    // Return all the paths where files were saved
    res.json({
      success: true,
      message: 'Test files for PDF export have been created',
      files: {
        input: testPath,
        assembled: path.join(tempDir, 'pdf_test_assembled.md'),
        cleaned: path.join(tempDir, 'pdf_test_cleaned.md'),
        numbered: path.join(tempDir, 'pdf_test_numbered.md'),
        final: path.join(tempDir, 'pdf_test_numbered_with_yaml.md')
      }
    });
  } catch (error) {
    console.error('TEST ERROR:', error);
    res.status(500).json({
      error: 'Failed to create test PDF files',
      details: error.message,
      stack: error.stack
    });
  }
});

/**
 * GET /test/save-file
 */

// --- SaaS Image Management Endpoints (added by AI) ---
const imageUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      // Default to 'admin' and 'test' if not provided
      const userId = req.body.userId || 'admin';
      const projectId = req.body.projectId || 'test';
      const dir = path.join(__dirname, 'uploads', userId, projectId);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      cb(null, `${Date.now()}-${file.originalname}`);
    }
  }),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB limit
  fileFilter: (req, file, cb) => {
    if ([
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/jpg',
      'image/webp'
    ].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported image type. Only JPEG, PNG, GIF, and WebP images are allowed.'), false);
    }
  }
});

// POST /upload-image (Cloudinary Cloud Storage)
app.post('/upload-image', rateLimiting.image, optimizedImageUpload, (req, res) => {
  const result = req.cloudinaryResult;
  
  console.log(`[CLOUDINARY] Image uploaded successfully: ${result.filename}`);
  
  res.json({ 
    success: true, 
    path: result.secure_url,  // Cloudinary URL for use in LaTeX/markdown
    public_id: result.public_id,
    url: result.secure_url,
    filename: result.filename
  });
});

// GET /list-images?userId=...&projectId=...
app.get('/list-images', (req, res) => {
  const { userId, projectId } = req.query;
  if (!userId || !projectId) {
    return res.status(400).json({ error: 'Missing userId or projectId' });
  }
  const dir = path.join(__dirname, 'uploads', userId, projectId);
  if (!fs.existsSync(dir)) return res.json({ images: [] });
  const files = fs.readdirSync(dir).filter(f => /\.(jpe?g|png|gif)$/i.test(f));
  res.json({ images: files.map(f => ({ filename: f, path: `uploads/${userId}/${projectId}/${f}` })) });
});

// POST /delete-image
app.post('/delete-image', (req, res) => {
  const { userId, projectId, filename } = req.body;
  if (!userId || !projectId || !filename) {
    return res.status(400).json({ error: 'Missing userId, projectId, or filename' });
  }
  const filePath = path.join(__dirname, 'uploads', userId, projectId, filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return res.json({ success: true });
  } else {
    return res.status(404).json({ error: 'File not found' });
  }
});

// POST /delete-all-images
app.post('/delete-all-images', (req, res) => {
  const { userId, projectId } = req.body;
  if (!userId || !projectId) {
    return res.status(400).json({ error: 'Missing userId or projectId' });
  }
  const dir = path.join(__dirname, 'uploads', userId, projectId);
  if (fs.existsSync(dir)) {
    fs.readdirSync(dir).forEach(f => {
      const filePath = path.join(dir, f);
      if (fs.lstatSync(filePath).isFile()) fs.unlinkSync(filePath);
    });
    return res.json({ success: true });
  } else {
    return res.status(404).json({ error: 'No images found' });
  }
});
// --- End SaaS Image Management Endpoints ---

/**
 * POST /upscale-image
 * Upscales an image to KDP-compatible resolution using the ImageMagic module
 * Expects: multipart/form-data with file upload and optional parameters
 * Returns: JSON with original and new image information
 * Required auth: JWT token
 */
app.post('/upscale-image', rateLimiting.image, authenticateJWT, imageUpload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }

    // Extract parameters from request
    const bookSize = req.body.bookSize || 'auto'; // Default to auto size detection
    const outputFormat = req.body.outputFormat || 'jpg'; // Default to jpg output
    
    // Create unique output filename
    const inputFilename = req.file.originalname;
    const timestamp = Date.now();
    const userId = req.user.id.toString();
    const outputFilename = `${path.parse(inputFilename).name}_KDP_${timestamp}.${outputFormat}`;
    
    // Setup paths
    const inputPath = req.file.path;
    const userUploadsDir = path.join(__dirname, 'uploads', userId, 'kdp-ready');
    
    // Ensure directory exists
    if (!fs.existsSync(userUploadsDir)) {
      fs.mkdirSync(userUploadsDir, { recursive: true });
    }
    
    const outputPath = path.join(userUploadsDir, outputFilename);

    // Perform the upscaling
    const result = await upscaleImage(inputPath, outputPath, bookSize);
    
    // Remove the input file
    fs.unlinkSync(inputPath);
    
    // Schedule automatic deletion after 15 minutes (900000 milliseconds)
    setTimeout(() => {
      try {
        if (fs.existsSync(outputPath)) {
          fs.unlinkSync(outputPath);
          console.log(`Auto-cleanup: Deleted ${outputFilename} after 15 minutes`);
        }
      } catch (deleteError) {
        console.error(`Auto-cleanup error for ${outputFilename}:`, deleteError);
      }
    }, 900000);
    
    // Return the result
    res.json({
      success: true,
      message: 'Image successfully upscaled for KDP',
      originalSize: result.originalSize,
      newSize: result.newSize,
      outputPath: `/uploads/${userId}/kdp-ready/${outputFilename}`,
      kdpReady: true,
      dpi: 300,
      bookSize: bookSize === 'auto' ? 'auto-detected' : bookSize,
      expiresIn: '15 minutes' // Notify the user that the file will expire
    });
  } catch (error) {
    console.error('Image upscaling error:', error);
    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    return res.status(500).json({
      error: 'Image upscaling failed',
      details: error.message
    });
  }
});

/**
 * GET /kdp-sizes
 * Returns a list of available KDP sizes for book covers
 */
app.get('/kdp-sizes', (req, res) => {
  // Create an array with the keys in the correct order to maintain the order in the UI
  const sizeOrder = [
    '6x9',
    '5x8',
    '5.06x7.81',
    '5.25x8',
    '5.5x8.5',
    '6.14x9.21',
    '6.69x9.61',
    '7x10',
    '7.44x9.69',
    '7.5x9.25',
    '8x10',
    '8.5x11'
  ];
  
  const sizes = sizeOrder.map(key => ({
    id: key,
    name: `${key}" (${getMetricSize(key)})`,
    width: KDP_SIZES[key].width,
    height: KDP_SIZES[key].height,
    dpi: 300
  }));
  
  res.json({
    success: true,
    sizes
  });
});

// Helper function to convert book size to metric
function getMetricSize(size) {
  const parts = size.split('x');
  if (parts.length !== 2) return size;
  
  const width = parseFloat(parts[0]);
  const height = parseFloat(parts[1]);
  
  if (isNaN(width) || isNaN(height)) return size;
  
  // Convert inches to centimeters (1 inch = 2.54 cm)
  const cmWidth = (width * 2.54).toFixed(2);
  const cmHeight = (height * 2.54).toFixed(2);
  
  return `${cmWidth} x ${cmHeight} cm`;
}

// Utility to copy images referenced in markdown to export dir
function copyImagesForExport(markdown, userId, projectId, exportDir) {
  console.log(`[IMAGE COPY] Starting image copy process...`);
  console.log(`[IMAGE COPY] userId: ${userId}, projectId: ${projectId}`);
  console.log(`[IMAGE COPY] exportDir: ${exportDir}`);
  console.log(`[IMAGE COPY] Server directory: ${__dirname}`);
  console.log(`[IMAGE COPY] Current working directory: ${process.cwd()}`);
  console.log(`[IMAGE COPY] NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
  console.log(`[IMAGE COPY] Markdown content length: ${markdown.length}`);
  
  // Ensure export directory exists
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
    console.log(`[IMAGE COPY] Created export directory: ${exportDir}`);
  } else {
    console.log(`[IMAGE COPY] Export directory already exists: ${exportDir}`);
    // List existing files in export directory
    try {
      const existingFiles = fs.readdirSync(exportDir);
      console.log(`[IMAGE COPY] Existing files in export directory: ${existingFiles.join(', ')}`);
    } catch (err) {
      console.log(`[IMAGE COPY] Could not list export directory: ${err.message}`);
    }
  }
  
  // Handle both LaTeX \includegraphics and {{IMAGE:...}} placeholders
  
  // First, handle LaTeX \includegraphics commands
  const latexImageRegex = /\\includegraphics.*?{([^}]+)}/g;
  let match;
  let imageCount = 0;
  console.log(`[IMAGE COPY] Searching for LaTeX \\includegraphics commands...`);
  while ((match = latexImageRegex.exec(markdown)) !== null) {
    const imageName = match[1];
    imageCount++;
    console.log(`[IMAGE COPY] Found LaTeX image ${imageCount}: ${imageName}`);
    copyImageFile(imageName, userId, projectId, exportDir, 'LaTeX');
  }
  console.log(`[IMAGE COPY] Found ${imageCount} LaTeX images total`);
  
  // Then, handle {{IMAGE:...}} placeholders
  const placeholderImageRegex = /\{\{IMAGE:([^|}]*)\|([^|}]*)\|([^|}]*)\}\}/g;
  let placeholderCount = 0;
  console.log(`[IMAGE COPY] Searching for {{IMAGE:...}} placeholders...`);
  while ((match = placeholderImageRegex.exec(markdown)) !== null) {
    const imagePath = match[1];
    placeholderCount++;
    // Extract just the filename from the path
    const imageName = path.basename(imagePath);
    console.log(`[IMAGE COPY] Found placeholder image ${placeholderCount}: ${imagePath} -> ${imageName}`);
    copyImageFile(imageName, userId, projectId, exportDir, 'placeholder');
  }
  console.log(`[IMAGE COPY] Found ${placeholderCount} placeholder images total`);
  
  if (imageCount === 0 && placeholderCount === 0) {
    console.log(`[IMAGE COPY] WARNING: No images found in markdown content!`);
    console.log(`[IMAGE COPY] First 500 chars of markdown:`, markdown.substring(0, 500));
  }
}

// Helper function to copy a single image file with multiple fallback locations
function copyImageFile(imageName, userId, projectId, exportDir, source) {
  const destPath = path.join(exportDir, imageName);
  
  // Skip if already copied
  if (fs.existsSync(destPath)) {
    console.log(`[IMAGE COPY] ✓ ${source} image already exists: ${imageName}`);
    return;
  }
  
  console.log(`[IMAGE COPY] Attempting to copy ${source} image: ${imageName}`);
  console.log(`[IMAGE COPY] Looking for userId: ${userId}, projectId: ${projectId}`);
  
  // List of possible source locations to check - more comprehensive and organized
  const possibleSources = [
    // Primary: User-specific project directory (most common case)
    path.join(__dirname, 'uploads', userId, projectId, imageName),
    
    // Fallback 1: Direct uploads directory (backup copies)
    path.join(__dirname, 'uploads', imageName),
    
    // Fallback 2: User directory without project (legacy uploads)
    path.join(__dirname, 'uploads', userId, imageName),
    
    // Fallback 3: For deployment environments - different working directory
    path.join(process.cwd(), 'uploads', userId, projectId, imageName),
    path.join(process.cwd(), 'uploads', imageName),
    path.join(process.cwd(), 'uploads', userId, imageName),
    
    // Fallback 4: Backend app structure (one level up)
    path.join(__dirname, '..', 'backend', 'uploads', userId, projectId, imageName),
    path.join(__dirname, '..', 'backend', 'uploads', imageName),
    
    // Fallback 5: Alternative app structure
    path.join(__dirname, '..', 'back_end', 'uploads', userId, projectId, imageName),
    path.join(__dirname, '..', 'back_end', 'uploads', imageName),
    
    // Fallback 6: Render/deployment-specific paths
    path.join('/app', 'uploads', userId, projectId, imageName),
    path.join('/app', 'uploads', imageName),
    path.join('/app', 'uploads', userId, imageName),
    
    // Fallback 7: Check if uploads is at a different level
    path.join(process.cwd(), '..', 'uploads', userId, projectId, imageName),
    path.join(process.cwd(), '..', 'uploads', imageName),
    path.join(process.cwd(), '..', 'uploads', userId, imageName),
  ];
  
  // Add recursive search results to the possibilities
  const foundPaths = findImageInUploads(imageName);
  possibleSources.push(...foundPaths);
  
  // Try each possible source location
  console.log(`[IMAGE COPY] Will check ${possibleSources.length} possible locations for ${imageName}`);
  
  for (let i = 0; i < possibleSources.length; i++) {
    const srcPath = possibleSources[i];
    
    if (fs.existsSync(srcPath)) {
      console.log(`[IMAGE COPY] ✓ Found ${imageName} at: ${srcPath}`);
      try {
        fs.copyFileSync(srcPath, destPath);
        console.log(`[IMAGE COPY] ✓ Successfully copied ${source} image: ${imageName}`);
        console.log(`[IMAGE COPY]   From: ${srcPath}`);
        console.log(`[IMAGE COPY]   To: ${destPath}`);
        return;
      } catch (err) {
        console.error(`[IMAGE COPY] ✗ Failed to copy ${imageName} from ${srcPath}:`, err.message);
      }
    }
  }
  
  // If we get here, the image wasn't found anywhere
  console.error(`[IMAGE COPY] ✗ FAILED: Image not found: ${imageName}`);
  console.error(`[IMAGE COPY] Checked ${possibleSources.length} locations without success`);
  
  // Enhanced debugging: look for similar files
  console.log(`[IMAGE COPY] === ENHANCED DEBUGGING FOR ${imageName} ===`);
  
  // Check all uploads directories that exist
  const debugDirs = [
    path.join(__dirname, 'uploads'),
    path.join(process.cwd(), 'uploads'),
    path.join(__dirname, '..', 'backend', 'uploads'),
    path.join(__dirname, '..', 'back_end', 'uploads'),
    path.join('/app', 'uploads')
  ];
  
  for (const uploadsDir of debugDirs) {
    if (fs.existsSync(uploadsDir)) {
      console.log(`[IMAGE COPY] Uploads directory exists: ${uploadsDir}`);
      try {
        // List all subdirectories in uploads
        const items = fs.readdirSync(uploadsDir);
        console.log(`[IMAGE COPY]   Contains: ${items.slice(0, 10).join(', ')}${items.length > 10 ? '...' : ''}`);
        
        // Look for the specific image name
        const imageFiles = items.filter(item => {
          const itemPath = path.join(uploadsDir, item);
          if (fs.statSync(itemPath).isFile() && item === imageName) {
            return true;
          }
          return false;
        });
        
        if (imageFiles.length > 0) {
          console.log(`[IMAGE COPY]   *** FOUND ${imageName} directly in ${uploadsDir} ***`);
        }
        
        // Look for files with similar names (for debugging)
        const similarFiles = items.filter(item => 
          item.toLowerCase().includes('vanquish') || 
          item.includes(imageName.substring(0, 10))
        );
        
        if (similarFiles.length > 0) {
          console.log(`[IMAGE COPY]   Similar files: ${similarFiles.join(', ')}`);
        }
        
      } catch (err) {
        console.log(`[IMAGE COPY]   Could not list contents: ${err.message}`);
      }
    }
  }
}

// Helper function to recursively search for an image in the uploads directory
function findImageInUploads(imageName) {
  const foundPaths = [];
  
  // Multiple potential uploads directories for different deployment environments
  const uploadsDirectories = [
    path.join(__dirname, 'uploads'),
    path.join(process.cwd(), 'uploads'),
    path.join('/app', 'uploads'),
    path.join(process.cwd(), 'app', 'uploads'),
    path.join(process.cwd(), '..', 'uploads')
  ];
  
  function searchRecursive(dir) {
    try {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const itemPath = path.join(dir, item);
        const stat = fs.lstatSync(itemPath);
        
        if (stat.isDirectory()) {
          // Recursively search subdirectories
          searchRecursive(itemPath);
        } else if (stat.isFile() && item === imageName) {
          // Found the image file
          foundPaths.push(itemPath);
        }
      }
    } catch (err) {
      // Ignore permission errors or inaccessible directories
      console.log(`[IMAGE COPY] Cannot access directory ${dir}: ${err.message}`);
    }
  }
  
  // Search in each potential uploads directory
  for (const uploadsDir of uploadsDirectories) {
    if (fs.existsSync(uploadsDir)) {
      console.log(`[IMAGE COPY] Searching in uploads directory: ${uploadsDir}`);
      searchRecursive(uploadsDir);
    }
  }
  
  return foundPaths;
}

// Utility: Clean up LaTeX image includes to use only user-specified scale
function cleanLatexImageIncludes(markdown) {
  // Replace \includegraphics with scale and/or width so only width=...\textwidth remains, using the scale value if present
  // Handles \includegraphics[scale=0.25, width=0.6\textwidth]{...} and similar
  return markdown.replace(/(\\includegraphics\[)([^\]]*?)(scale\s*=\s*([0-9.]+))([^\]]*)\]({[^}]+})/g, (match, start, before, scalePart, scaleValue, after, imagePath) => {
    // Remove any width or scale attributes in 'before' and 'after'
    let cleanBefore = before.replace(/(,?\s*(width|scale)\s*=\s*[^,\]]*)/g, '');
    let cleanAfter = after.replace(/(,?\s*(width|scale)\s*=\s*[^,\]]*)/g, '');
    return `${start}${cleanBefore}width=${scaleValue}\\textwidth${cleanAfter}]${imagePath}`;
  })
  // Remove any remaining width or scale attributes if only width should remain (no scale present)
  .replace(/(\\includegraphics\[)([^\]]*?)(,?\s*scale\s*=\s*[^,\]]*)+([^\]]*)\]({[^}]+})/g, (match, start, before, scaleAttrs, after, imagePath) => {
    // Remove all scale attributes, keep only width if present
    let cleanBefore = before.replace(/(,?\s*scale\s*=\s*[^,\]]*)/g, '');
    let cleanAfter = after.replace(/(,?\s*scale\s*=\s*[^,\]]*)/g, '');
    return `${start}${cleanBefore}${cleanAfter}]${imagePath}`;
  })
  // Remove duplicate width attributes (keep only the last one)
  .replace(/(\\includegraphics\[)([^\]]*?)(width\s*=\s*([0-9.]+)\\textwidth)([^\]]*?)(width\s*=\s*([0-9.]+)\\textwidth)([^\]]*)\]({[^}]+})/g, (match, start, before, width1, between, width2, after, imagePath) => {
    // Keep only the last width
    return `${start}${before}${between}${width2}${after}]${imagePath}`;
  });
}

// Utility: Convert legacy image syntax to {{IMAGE:...}} placeholder
function convertLegacyImagesToPlaceholder(markdown) {
  // Convert LaTeX \includegraphics[...]{src} to {{IMAGE:src|Image|0.6}}
  markdown = markdown.replace(/\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}/g, (match, src) => {
    return `{{IMAGE:${src}|Image|0.6}}`;
  });
  // Convert Markdown images ![alt](src) to {{IMAGE:src|alt|0.6}}
  markdown = markdown.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
    return `{{IMAGE:${src}|${alt || 'Image'}|0.6}}`;
  });
  return markdown;
}

// If using public directory
const DEFAULT_AVATAR = '/default-avatar.png';

// MongoDB connection
const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/publishjockey';
mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected:', mongoUri))
.catch(err => console.error('MongoDB connection error:', err));

const db = mongoose.connection;
db.on('error', (err) => console.error('MongoDB connection error:', err));
db.once('open', () => {
  console.log('MongoDB connected:', mongoUri);
  // Create indexes for performance
  try {
    Project.collection.createIndex({ userId: 1 });
    console.log('MongoDB indexes created successfully');
  } catch (err) {
    console.error('Error creating indexes:', err);
  }
});

// Project (Book) Schema
const projectSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { 
    type: mongoose.Schema.Types.Mixed, // Using Mixed type for flexible content structure
    default: {} 
  },
  structure: {
    type: mongoose.Schema.Types.Mixed, // Using Mixed type for flexible structure
    default: {
      front: [
        "Title Page",
        "Copyright",
        "Disclaimer",
        "Acknowledgments",
        "Foreword",
        "Introduction"
      ],
      main: ["Chapter 1", "Chapter 2", "Chapter 3"],
      back: ["Appendix", "References"]
    }
  },
  // Add metadata fields
  author: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  isbn: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  // Add more fields as needed (e.g., coverImage, status, etc.)
}, { 
  // Add these options to ensure large content objects are stored properly
  minimize: false, // Don't remove empty objects
  strict: false    // Allow fields not specified in the schema
});

// Add validator to ensure content is stored as an object
projectSchema.path('content').validate(function(value) {
  return value === null || value === undefined || typeof value === 'object';
}, 'Content must be an object');

projectSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const Project = mongoose.model('Project', projectSchema);

// JWT auth middleware
function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('Missing or invalid Authorization header');
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  const token = authHeader.split(' ')[1];
  
  // Debug token
  console.log('Token received:', token ? `${token.substring(0, 10)}...${token.substring(token.length - 10)}` : 'NONE');
  console.log('Using JWT_SECRET:', JWT_SECRET ? `${JWT_SECRET.substring(0, 10)}...` : 'NOT FOUND');
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Set user object with ID from either id or userId property
    req.user = {
      ...decoded,
      id: decoded.id || decoded.userId || decoded.user_id // Support multiple ID formats
    };

    // Log for debugging
    console.log('JWT authenticated with user:', {
      id: req.user.id,
      email: req.user.email || 'not provided',
      tokenPayload: decoded
    });
    
    // Ensure we have a valid user ID
    if (!req.user.id) {
      console.error('Missing user ID in token payload:', decoded);
      return res.status(401).json({ error: 'Invalid token: missing user identifier' });
    }
    
    next();
  } catch (err) {
    console.error('JWT verification error:', err.message);
    console.error('JWT verification error details:', {
      name: err.name,
      message: err.message,
      tokenLength: token ? token.length : 0,
      secretLength: JWT_SECRET ? JWT_SECRET.length : 0
    });
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// GET /api/projects - List all projects for the authenticated user
app.get('/api/projects', authenticateJWT, async (req, res) => {
  try {
    const projects = await Project.find({ userId: req.user.id }).sort({ updatedAt: -1 });
    res.json({ projects });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch projects', details: err.message });
  }
});

// POST /api/projects - Create a new project
app.post('/api/projects', authenticateJWT, async (req, res) => {
  try {
    const { title, description, author, subtitle, isbn } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });
    
    // Check if user has books remaining by calling the user service
    try {
      const userResponse = await axios.put(
        `${process.env.USER_SERVICE_URL || 'http://localhost:3001'}/api/users/me/books/decrement`,
        {},
        {
          headers: {
            Authorization: req.headers.authorization
          }
        }
      );
      
      if (!userResponse.data.success) {
        return res.status(403).json({ 
          error: 'Book limit reached',
          message: userResponse.data.message || 'You have reached your book limit. Please upgrade your plan.'
        });
      }
    } catch (error) {
      // If we can't reach the user service or there's another error
      console.error('Error checking book limit:', error);
      // Continue with creation but log the error
    }
    
    const project = new Project({
      title,
      description,
      author: author || '',
      subtitle: subtitle || '',
      isbn: isbn || '',
      userId: req.user.id || req.user.userId
    });
    await project.save();
    // --- EXTRA LOGGING: Print the full project document after save ---
    console.log('[POST /api/projects] Saved project:', JSON.stringify(project.toObject(), null, 2));
    res.status(201).json({ project });
  } catch (err) {
    console.error('Error in POST /api/projects:', err);
    res.status(500).json({ error: 'Failed to create project', details: err.message, stack: err.stack });
  }
});

// GET /api/projects/:id - Get a single project
app.get('/api/projects/:id', authenticateJWT, async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, userId: req.user.id });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json({ project });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch project', details: err.message });
  }
});

// PUT /api/projects/:id - Update a project
app.put('/api/projects/:id', authenticateJWT, async (req, res) => {
  try {
    const { title, description, content, author, subtitle, isbn, structure } = req.body;
    console.log('PUT /api/projects/:id - Request received:', {
      projectId: req.params.id,
      userId: req.user.id,
      hasContent: !!content,
      contentSize: content ? Object.keys(content).length : 0,
      hasStructure: !!structure,
      title: title || '[not provided]',
      author: author || '[not provided]',
      subtitle: subtitle || '[not provided]',
      isbn: isbn || '[not provided]'
    });
    
    const updateFields = { updatedAt: Date.now() };
    if (title !== undefined) updateFields.title = title;
    if (description !== undefined) updateFields.description = description;
    if (content !== undefined) updateFields.content = content;
    if (structure !== undefined) updateFields.structure = structure;
    // Add metadata fields to update
    if (author !== undefined) updateFields.author = author;
    if (subtitle !== undefined) updateFields.subtitle = subtitle;
    if (isbn !== undefined) updateFields.isbn = isbn;
    
    console.log('Update fields:', {
      ...updateFields,
      content: content ? `${Object.keys(content).length} sections` : null,
      structure: structure ? 'provided' : null
    });

    // Find the project first to verify it exists
    const existingProject = await Project.findOne({ _id: req.params.id, userId: req.user.id });
    
    if (!existingProject) {
      console.log('Project not found:', { projectId: req.params.id, userId: req.user.id });
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Perform the update now that we know the project exists
    const project = await Project.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { $set: updateFields },
      { new: true }
    );
    
    // --- EXTRA LOGGING: Print the full project document after update ---
    if (project) {
      console.log('[PUT /api/projects/:id] Updated project:', JSON.stringify(project.toObject(), null, 2));
    }
    
    // Double-check update was successful
    if (!project) {
      console.error('Project update failed:', { projectId: req.params.id, userId: req.user.id });
      return res.status(500).json({ error: 'Failed to update project' });
    }
    
    // Verify content was saved if it was provided
    if (content && (!project.content || Object.keys(project.content).length === 0)) {
      console.error('Content was not saved properly:', { 
        projectId: project._id,
        contentAfterUpdate: project.content ? Object.keys(project.content).length : 0
      });
      
      // Force a direct save to ensure content is stored
      if (existingProject) {
        existingProject.content = content;
        existingProject.updatedAt = Date.now();
        // Also update metadata if provided
        if (author !== undefined) existingProject.author = author;
        if (subtitle !== undefined) existingProject.subtitle = subtitle;
        if (isbn !== undefined) existingProject.isbn = isbn;
        await existingProject.save();
        console.log('Forced content save complete');
      }
    }
    
    // Verify structure was saved if it was provided
    if (structure && (!project.structure || JSON.stringify(project.structure) !== JSON.stringify(structure))) {
      console.error('Structure was not saved properly:', { 
        projectId: project._id,
        structureAfterUpdate: project.structure ? JSON.stringify(project.structure) : 'none',
        originalStructure: JSON.stringify(structure)
      });
      
      // Force a direct save to ensure structure is stored
      if (existingProject) {
        existingProject.structure = structure;
        await existingProject.save();
        console.log('Forced structure save complete');
        
        // Update project reference with the forced saved data
        project.structure = existingProject.structure;
      }
    }
    
    console.log('Project updated successfully:', {
      projectId: project._id,
      title: project.title,
      author: project.author,
      hasContent: !!project.content,
      contentSize: project.content ? Object.keys(project.content).length : 0,
      hasStructure: !!project.structure,
      structure: project.structure ? JSON.stringify(project.structure) : 'none'
    });
    
    // Return the updated project with explicit success message
    res.json({ 
      success: true, 
      message: 'Project updated successfully',
      project: project,
      structure: project.structure 
    });
  } catch (err) {
    console.error('Error updating project:', err);
    res.status(500).json({ error: 'Failed to update project', details: err.message });
  }
});

// DELETE /api/projects/:id - Delete a project
app.delete('/api/projects/:id', authenticateJWT, async (req, res) => {
  try {
    const result = await Project.deleteOne({ _id: req.params.id, userId: req.user.id });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Project not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete project', details: err.message });
  }
});

// DEBUG route to get raw project data (for troubleshooting only)
app.get('/api/debug/projects/:id', authenticateJWT, async (req, res) => {
  try {
    // Get project directly from MongoDB without processing
    const project = await Project.findOne(
      { _id: req.params.id, userId: req.user.id }
    ).lean();
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Check the content field size
    const contentSize = project.content ? 
      Buffer.byteLength(JSON.stringify(project.content)) : 0;
    
    res.json({ 
      project,
      debug: {
        contentSize: `${(contentSize / 1024).toFixed(2)} KB`,
        contentKeys: project.content ? Object.keys(project.content) : [],
        hasContent: !!project.content && Object.keys(project.content).length > 0
      }
    });
  } catch (err) {
    console.error('Error getting debug project data:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST route to force save a project's content (for troubleshooting)
app.post('/api/debug/save-content/:id', authenticateJWT, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ error: 'No content provided' });
    }
    
    // Get the project
    const project = await Project.findOne({ _id: req.params.id, userId: req.user.id });
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Directly set the content and save
    project.content = content;
    project.updatedAt = Date.now();
    await project.save();
    
    res.json({ 
      success: true,
      project: {
        id: project._id,
        title: project.title,
        contentKeys: Object.keys(project.content || {})
      }
    });
  } catch (err) {
    console.error('Error in force save content:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST route to force save a project's structure (for troubleshooting)
app.post('/api/debug/save-structure/:id', authenticateJWT, async (req, res) => {
  try {
    const { structure } = req.body;
    if (!structure) {
      return res.status(400).json({ error: 'No structure provided' });
    }
    
    console.log('Debug save structure endpoint called:', {
      projectId: req.params.id,
      userId: req.user.id,
      structure: JSON.stringify(structure)
    });
    
    // Get the project
    const project = await Project.findOne({ _id: req.params.id, userId: req.user.id });
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Directly set the structure and save
    project.structure = structure;
    project.updatedAt = Date.now();
    await project.save();
    
    console.log('Structure saved directly:', JSON.stringify(project.structure, null, 2));
    
    res.json({ 
      success: true,
      project: {
        id: project._id,
        title: project.title,
        structure: project.structure
      }
    });
  } catch (err) {
    console.error('Error in force save structure:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/uploads (Cloudinary Cloud Storage with Authentication)
app.post('/api/uploads', rateLimiting.image, authenticateJWT, optimizedImageUpload, async (req, res) => {
  try {
    console.log('[UPLOAD DEBUG] Starting authenticated upload process');
    console.log('[UPLOAD DEBUG] User:', req.user?.id);
    console.log('[UPLOAD DEBUG] Request body:', req.body);
    console.log('[UPLOAD DEBUG] Cloudinary result exists:', !!req.cloudinaryResult);
    
    const result = req.cloudinaryResult;
    if (!result) {
      console.error('[UPLOAD ERROR] No cloudinary result found in request');
      return res.status(500).json({ success: false, error: 'Upload processing failed - no result from cloudinary' });
    }
    
    const userId = req.user.id;
    console.log('[UPLOAD DEBUG] User ID:', userId);
    
    // Check project ownership
    const projectId = req.body && req.body.projectId;
    if (!projectId) {
      console.error('[UPLOAD ERROR] Missing projectId in request body');
      return res.status(400).json({ success: false, error: 'Missing projectId in request body' });
    }
    
    console.log('[UPLOAD DEBUG] Project ID:', projectId);
    
    let project;
    try {
      console.log('[UPLOAD DEBUG] Attempting to find project in database');
      project = await Project.findOne({ _id: projectId, userId });
      console.log('[UPLOAD DEBUG] Project found:', !!project);
    } catch (e) {
      console.error('[UPLOAD ERROR] Database error finding project:', e);
      return res.status(400).json({ success: false, error: 'Invalid projectId format', details: e.message });
    }
    
    if (!project) {
      console.error('[UPLOAD ERROR] Project not found or user does not have permission');
      return res.status(403).json({ success: false, error: 'You do not have permission to upload images to this project.' });
    }
    
    console.log(`[CLOUDINARY] Authenticated image upload for user ${userId}, project ${projectId}: ${result.filename || result.original_filename}`);
    
    const response = { 
      success: true, 
      path: result.secure_url,
      public_id: result.public_id,
      url: result.secure_url,
      filename: result.filename || result.original_filename
    };
    
    console.log('[UPLOAD DEBUG] Sending successful response:', response);
    res.json(response);
    
  } catch (error) {
    console.error('[UPLOAD ERROR] Unexpected error in /api/uploads:', error);
    console.error('[UPLOAD ERROR] Error stack:', error.stack);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error during upload',
      details: error.message 
    });
  }
});

// Helper to estimate page count from markdown/sections
function estimatePageCount(sections) {
  // Simple heuristic: 350 words per page
  const totalWords = sections.reduce((sum, s) => sum + (s.content ? s.content.split(/\s+/).length : 0), 0);
  return Math.ceil(totalWords / 350);
}

// --- Export limiting helper (now allows partial export for free users) ---
async function enforceExportLimitOrSlice(req, res, sections) {
  const userId = req.user.id;
  const user = await User.findById(userId);
  if (!user) {
    console.error('User not found for export:', userId);
    return { error: res.status(401).json({ error: 'User not found' }) };
  }
  const pageLimit = 12;
  const pageEstimate = (s) => (s.content ? s.content.split(/\s+/).length : 0) / 350;
  let totalPages = 0;
  let includedSections = [];
  if (user.subscription === 'free') {
    // Accumulate sections until we reach the page limit, allowing partial section at paragraph boundary
    for (const section of sections) {
      const sectionWords = section.content ? section.content.split(/\s+/) : [];
      const sectionPages = sectionWords.length / 350;
      if (totalPages + sectionPages < pageLimit) {
        includedSections.push(section);
        totalPages += sectionPages;
      } else {
         // Calculate how many words are allowed in this section
        const allowedWords = Math.floor((pageLimit - totalPages) * 350);

        // Split section into header and body
        const lines = (section.content || '').split('\n');
        let header = '';
        let bodyLines = [];
        if (lines[0].trim().startsWith('#')) {
          header = lines[0];
          bodyLines = lines.slice(1);
        } else {
          bodyLines = lines;
        }
      
        // Accumulate lines up to the word limit, ending at a paragraph boundary
        let accumulatedLines = [];
        let wordCount = 0;
        let lastBlankLineIdx = -1;
        for (let i = 0; i < bodyLines.length; i++) {
          const line = bodyLines[i];
          const wordsInLine = line.trim().split(/\s+/).filter(Boolean).length;
          wordCount += wordsInLine;
          accumulatedLines.push(line);
          if (line.trim() === '') lastBlankLineIdx = i;
          if (wordCount >= allowedWords) break;
        }
        // If we exceeded the limit, cut at the last blank line
        if (wordCount >= allowedWords && lastBlankLineIdx !== -1) {
          accumulatedLines = accumulatedLines.slice(0, lastBlankLineIdx + 1);
        }
        let truncatedBody = accumulatedLines.join('\n').trim();
        // Add a notice if this is a truncated export for free users
        const sampleNotice = '\n\n---\n\nThis is a sample export generated by PublishJockey. To unlock full book exports and access all features, please choose a plan that fits your needs.';
        let truncatedContent = header ? `${header}\n\n${truncatedBody}${sampleNotice}` : `${truncatedBody}${sampleNotice}`;
        includedSections.push({ ...section, content: truncatedContent });
        break;
      }
    }
    console.log(`[EXPORT PARTIAL] Free user: Exporting up to ${pageLimit} pages (estimated). Sections included: ${includedSections.length}`);
    return { sections: includedSections, partial: true };
  }
  // Paid/beta users: no limit
  return { sections, partial: false };
}

/**
 * DELETE /cleanup/:fileId
 * Deletes temporary export files after they are no longer needed
 */
app.delete('/cleanup/:fileId', (req, res) => {
  try {
    const { fileId } = req.params;
    
    // Check if the file ID exists in our tracking system
    if (tempExportFiles.has(fileId)) {
      const filePath = tempExportFiles.get(fileId);
      
      // Check if the file exists before attempting deletion
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`Successfully deleted temporary file: ${filePath}`);
      }
      
      // Remove from tracking regardless of whether file exists
      tempExportFiles.delete(fileId);
      
      return res.json({ 
        success: true, 
        message: `File ${fileId} successfully deleted` 
      });
    } else {
      console.log(`File ID ${fileId} not found in tracking system`);
      return res.status(404).json({ 
        success: false, 
        message: 'File ID not found in tracking system' 
      });
    }
  } catch (error) {
    console.error('Error deleting temporary file:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to delete file',
      details: error.message 
    });
  }
});

// Scheduled cleanup for temporary files
setInterval(() => {
  const now = Date.now();
  
  // Check all tracked temporary files
  for (const [fileId, filePath] of tempExportFiles.entries()) {
    // Get file creation time from fileId (format: projectId_timestamp)
    const parts = fileId.split('_');
    if (parts.length > 1) {
      const timestamp = parseInt(parts[parts.length - 1], 10);
      
      // If file is older than 15 minutes (900000 ms), delete it
      if (!isNaN(timestamp) && (now - timestamp > 900000)) {
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
            console.log(`Auto-deleted expired temporary file: ${filePath}`);
          } catch (err) {
            console.error(`Failed to auto-delete file ${filePath}:`, err);
          }
        }
        
        // Remove from tracking
        tempExportFiles.delete(fileId);
      }
    }
  }
}, 5 * 60 * 1000); // Run cleanup check every 5 minutes

// Create a new endpoint to serve files explicitly when requested
app.get('/api/files/:fileId', (req, res) => {
  const { fileId } = req.params;
  const suggestedFilename = req.query.filename || null; // Get suggested filename from query param
  
  console.log(`File download requested for fileId: ${fileId}, suggested filename: ${suggestedFilename}`);
  
  // Check if the file exists in our tracking system
  if (tempExportFiles.has(fileId)) {
    const filePath = tempExportFiles.get(fileId);
    console.log(`File found in tracking system: ${filePath}`);
    
    // Check if the file exists on disk
    if (fs.existsSync(filePath)) {
      // Get file extension to determine content type
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes = {
        '.pdf': 'application/pdf',
        '.epub': 'application/epub+zip',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif'
      };
      
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      
      // Use suggested filename if provided, otherwise use the original filename
      const fileName = suggestedFilename || path.basename(filePath);
      
      // Ensure filename has proper extension
      const fileNameWithExt = fileName.endsWith(ext) ? fileName : `${fileName}${ext}`;
      
      // Set headers for explicitly requested download
      res.setHeader('Content-Type', contentType);
      
      // Use proper Content-Disposition header to suggest filename to browser
      // Note: filename* encoding helps with UTF-8 characters in filenames
      res.setHeader('Content-Disposition', `attachment; filename="${fileNameWithExt}"; filename*=UTF-8''${encodeURIComponent(fileNameWithExt)}`);
      
      // Disable caching to ensure fresh content
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      console.log(`Sending file: ${filePath} with content-type: ${contentType}, suggested filename: ${fileNameWithExt}`);
      
      // Send the file
      return res.sendFile(path.resolve(filePath), { dotfiles: 'allow' }, (err) => {
        if (err) {
          console.error(`Error sending file ${filePath}:`, err);
          if (!res.headersSent) {
            return res.status(500).json({ error: 'Error sending file', details: err.message });
          }
        } else {
          console.log(`File sent successfully: ${filePath} as ${fileNameWithExt}`);
        }
      });
    } else {
      console.log(`File not found on disk: ${filePath}`);
      return res.status(404).json({ error: 'File not found on disk' });
    }
  } else {
    console.log(`File ID ${fileId} not found in tracking system`);
    return res.status(404).json({ error: 'File ID not found' });
  }
});

// Test endpoint for Cloudinary connectivity
app.get('/test/cloudinary', async (req, res) => {
  try {
    console.log('[CLOUDINARY TEST] Testing Cloudinary connection...');
    
    const cloudinary = require('cloudinary').v2;
    const config = cloudinary.config();
    
    console.log('[CLOUDINARY TEST] Configuration check:', {
      cloud_name: config.cloud_name ? 'SET' : 'NOT SET',
      api_key: config.api_key ? 'SET' : 'NOT SET', 
      api_secret: config.api_secret ? 'SET' : 'NOT SET'
    });
    
    // Test API connectivity
    const result = await cloudinary.api.ping();
    console.log('[CLOUDINARY TEST] Ping successful:', result);
    
    res.json({
      success: true,
      message: 'Cloudinary connection test successful',
      config: {
        cloud_name: config.cloud_name ? 'SET' : 'NOT SET',
        api_key: config.api_key ? 'SET' : 'NOT SET',
        api_secret: config.api_secret ? 'SET' : 'NOT SET'
      },
      ping: result
    });
    
  } catch (error) {
    console.error('[CLOUDINARY TEST] Connection test failed:', error);
    res.status(500).json({
      success: false,
      error: 'Cloudinary connection test failed',
      details: error.message
    });
  }
});
