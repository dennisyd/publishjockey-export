const { execFileSync } = require('child_process');

// Use custom Pandoc version if available, fallback to system pandoc
// Handle Windows vs Linux defaults properly
const PANDOC_PATH = process.env.PANDOC_PATH || 
  (process.platform === 'win32' ? 'pandoc' : '/root/.cache/pandoc-3.6.4');

function exportBook(assembledPath, outputPath, templatePath, numberedHeadings) {
  const baseArgs = [
    assembledPath,
    '-o', outputPath,
    '--pdf-engine=xelatex',
    '--template', templatePath,
    '--toc',
    '--toc-depth=2'
  ];
  if (numberedHeadings) baseArgs.push('--number-sections');
  execFileSync(PANDOC_PATH, baseArgs, { stdio: 'inherit' });
}

module.exports = { exportBook }; 