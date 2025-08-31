/**
 * Debug script to check what's actually stored in the database for books
 */

const mongoose = require('mongoose');

// Simple Project schema for debugging
const ProjectSchema = new mongoose.Schema({
  title: String,
  content: Object,
  structure: Object,
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

const Project = mongoose.model('Project', ProjectSchema);

async function debugBookContent() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/publishjockey';
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('✅ Connected to MongoDB');
    
    // Get all projects
    const projects = await Project.find({}).limit(5); // Limit to first 5 for testing
    
    console.log(`\n📚 Found ${projects.length} projects in database:`);
    
    projects.forEach((project, index) => {
      console.log(`\n--- PROJECT ${index + 1}: ${project.title} ---`);
      console.log(`ID: ${project._id}`);
      console.log(`Created: ${project.createdAt}`);
      console.log(`Updated: ${project.updatedAt}`);
      
      // Check content
      if (project.content && typeof project.content === 'object') {
        const contentKeys = Object.keys(project.content);
        console.log(`Content sections: ${contentKeys.length}`);
        console.log(`Content keys: ${contentKeys.join(', ')}`);
        
        // Check if sections have actual content (not just empty strings)
        const sectionsWithContent = contentKeys.filter(key => {
          const content = project.content[key];
          return content && typeof content === 'string' && content.trim().length > 0;
        });
        
        console.log(`Sections with actual content: ${sectionsWithContent.length}`);
        console.log(`Non-empty sections: ${sectionsWithContent.join(', ')}`);
        
        // Show preview of actual content
        sectionsWithContent.slice(0, 3).forEach(key => {
          const content = project.content[key];
          const preview = content.substring(0, 100) + (content.length > 100 ? '...' : '');
          console.log(`  ${key}: "${preview}"`);
        });
      } else {
        console.log('❌ No content object found');
      }
      
      // Check structure
      if (project.structure && typeof project.structure === 'object') {
        console.log(`Structure sections:`);
        ['front', 'main', 'back'].forEach(section => {
          if (project.structure[section] && Array.isArray(project.structure[section])) {
            console.log(`  ${section}: ${project.structure[section].length} sections`);
            console.log(`    ${project.structure[section].join(', ')}`);
          }
        });
      } else {
        console.log('❌ No structure object found');
      }
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

// Run the debug
if (require.main === module) {
  debugBookContent().then(() => {
    console.log('\n🏁 Debug complete');
    process.exit(0);
  }).catch(error => {
    console.error('💥 Debug failed:', error);
    process.exit(1);
  });
}

module.exports = { debugBookContent };
