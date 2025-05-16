const { execFileSync } = require('child_process');

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
  execFileSync('pandoc', baseArgs, { stdio: 'inherit' });
}

module.exports = { exportBook }; 