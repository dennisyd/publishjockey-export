// Simple metadata storage to pass between functions
const metadataStore = {};

module.exports = {
  storeMetadata: function(filePath, metadata) {
    metadataStore[filePath] = metadata;
    console.log(`Stored metadata for ${filePath}:`, metadata);
  },
  getStoredMetadata: function(filePath) {
    return metadataStore[filePath];
  }
};
