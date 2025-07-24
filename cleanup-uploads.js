const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

/**
 * Upload Storage Cleanup Utility
 * Identifies and removes duplicate files while preserving the most recent version
 */

class UploadCleaner {
    constructor(uploadsPath = './uploads') {
        this.uploadsPath = uploadsPath;
        this.duplicates = new Map(); // filename -> array of file info
        this.totalSizeScanned = 0;
        this.totalSizeDuplicates = 0;
        this.filesScanned = 0;
    }

    /**
     * Get file hash for content comparison
     */
    async getFileHash(filePath) {
        try {
            const fileBuffer = await fs.readFile(filePath);
            return crypto.createHash('md5').update(fileBuffer).digest('hex');
        } catch (error) {
            console.warn(`Could not hash file ${filePath}:`, error.message);
            return null;
        }
    }

    /**
     * Extract original filename from timestamped filename
     */
    extractOriginalFilename(filename) {
        // Remove timestamp prefix (e.g., "1753382777134-" from "1753382777134-cover.jpg")
        return filename.replace(/^\d{13}-/, '');
    }

    /**
     * Recursively scan directory for files
     */
    async scanDirectory(dirPath) {
        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                
                if (entry.isDirectory()) {
                    await this.scanDirectory(fullPath);
                } else if (entry.isFile()) {
                    await this.processFile(fullPath);
                }
            }
        } catch (error) {
            console.warn(`Could not scan directory ${dirPath}:`, error.message);
        }
    }

    /**
     * Process individual file
     */
    async processFile(filePath) {
        try {
            const stats = await fs.stat(filePath);
            const filename = path.basename(filePath);
            const originalName = this.extractOriginalFilename(filename);
            
            this.filesScanned++;
            this.totalSizeScanned += stats.size;

            // Skip very small files (likely not images)
            if (stats.size < 1000) return;

            const fileInfo = {
                path: filePath,
                filename: filename,
                originalName: originalName,
                size: stats.size,
                mtime: stats.mtime,
                hash: await this.getFileHash(filePath)
            };

            // Group by original filename
            if (!this.duplicates.has(originalName)) {
                this.duplicates.set(originalName, []);
            }
            this.duplicates.get(originalName).push(fileInfo);

        } catch (error) {
            console.warn(`Could not process file ${filePath}:`, error.message);
        }
    }

    /**
     * Identify duplicates for removal
     */
    identifyDuplicates() {
        const toRemove = [];
        let duplicateSize = 0;

        for (const [originalName, files] of this.duplicates) {
            if (files.length > 1) {
                console.log(`\n📁 Found ${files.length} versions of: ${originalName}`);
                
                // Sort by modification time (newest first)
                files.sort((a, b) => b.mtime - a.mtime);
                
                // Keep the newest, mark others for removal
                const [newest, ...oldVersions] = files;
                console.log(`   ✅ Keeping: ${newest.filename} (${this.formatSize(newest.size)}) - ${newest.mtime.toISOString()}`);
                
                for (const oldFile of oldVersions) {
                    console.log(`   🗑️  Remove: ${oldFile.filename} (${this.formatSize(oldFile.size)}) - ${oldFile.mtime.toISOString()}`);
                    toRemove.push(oldFile);
                    duplicateSize += oldFile.size;
                }
            }
        }

        this.totalSizeDuplicates = duplicateSize;
        return toRemove;
    }

    /**
     * Format file size for display
     */
    formatSize(bytes) {
        const sizes = ['B', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 B';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
    }

    /**
     * Remove duplicate files
     */
    async removeDuplicates(filesToRemove, dryRun = true) {
        console.log(`\n${dryRun ? '🔍 DRY RUN' : '🗑️  REMOVING'} - Processing ${filesToRemove.length} duplicate files...`);
        
        let removedCount = 0;
        let removedSize = 0;

        for (const file of filesToRemove) {
            try {
                if (!dryRun) {
                    await fs.unlink(file.path);
                }
                removedCount++;
                removedSize += file.size;
                console.log(`${dryRun ? '   Would remove:' : '   Removed:'} ${file.path}`);
            } catch (error) {
                console.error(`Failed to remove ${file.path}:`, error.message);
            }
        }

        return { removedCount, removedSize };
    }

    /**
     * Main cleanup function
     */
    async cleanup(dryRun = true) {
        console.log(`🧹 Starting upload cleanup scan in: ${this.uploadsPath}`);
        console.log(`${dryRun ? '🔍 DRY RUN MODE - No files will be deleted' : '⚠️  LIVE MODE - Files will be permanently deleted!'}`);
        
        // Scan all files
        await this.scanDirectory(this.uploadsPath);
        
        // Identify duplicates
        const duplicatesToRemove = this.identifyDuplicates();
        
        // Show summary
        console.log(`\n📊 SCAN SUMMARY:`);
        console.log(`   Files scanned: ${this.filesScanned}`);
        console.log(`   Total size scanned: ${this.formatSize(this.totalSizeScanned)}`);
        console.log(`   Duplicate files found: ${duplicatesToRemove.length}`);
        console.log(`   Space that can be freed: ${this.formatSize(this.totalSizeDuplicates)}`);
        
        if (duplicatesToRemove.length > 0) {
            const result = await this.removeDuplicates(duplicatesToRemove, dryRun);
            
            console.log(`\n✅ CLEANUP COMPLETE:`);
            console.log(`   ${dryRun ? 'Would remove' : 'Removed'}: ${result.removedCount} files`);
            console.log(`   Space ${dryRun ? 'that would be' : ''} freed: ${this.formatSize(result.removedSize)}`);
            
            if (dryRun) {
                console.log(`\n💡 To actually remove files, run: node cleanup-uploads.js --execute`);
            }
        } else {
            console.log('\n✨ No duplicates found! Uploads directory is clean.');
        }
    }
}

// CLI execution
async function main() {
    const args = process.argv.slice(2);
    const executeMode = args.includes('--execute') || args.includes('-x');
    const uploadsPath = args.find(arg => arg.startsWith('--path='))?.split('=')[1] || './uploads';
    
    console.log('🚀 Upload Storage Cleanup Utility');
    console.log('=====================================');
    
    const cleaner = new UploadCleaner(uploadsPath);
    await cleaner.cleanup(!executeMode);
}

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = UploadCleaner; 