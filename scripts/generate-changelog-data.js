#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const CHANGELOGS_DIR = path.join(__dirname, '..', 'changelogs');
const OUTPUT_FILE = path.join(__dirname, '..', 'src', 'data', 'changelogData.js');

function parseChangelogFile(content, filename) {
  const lines = content.split('\n');
  
  // Parse frontmatter
  let frontmatterEnd = -1;
  let frontmatter = {};
  
  if (lines[0] === '---') {
    for (let i = 1; i < lines.length; i++) {
      if (lines[i] === '---') {
        frontmatterEnd = i;
        break;
      }
      
      const line = lines[i].trim();
      if (line && line.includes(':')) {
        const [key, ...valueParts] = line.split(':');
        const value = valueParts.join(':').trim().replace(/^["']|["']$/g, '');
        frontmatter[key.trim()] = value;
      }
    }
  }
  
  // Parse content sections
  const contentLines = lines.slice(frontmatterEnd + 1);
  const sections = [];
  let currentSection = null;
  
  for (const line of contentLines) {
    const trimmedLine = line.trim();
    
    // Check if it's a section header (## Title)
    if (trimmedLine.startsWith('## ')) {
      if (currentSection) {
        sections.push(currentSection);
      }
      currentSection = {
        title: trimmedLine.substring(3).trim(),
        items: []
      };
    }
    // Check if it's a list item (- Item)
    else if (trimmedLine.startsWith('- ') && currentSection) {
      currentSection.items.push(trimmedLine.substring(2).trim());
    }
  }
  
  // Don't forget the last section
  if (currentSection) {
    sections.push(currentSection);
  }
  
  // Extract version from filename if not in frontmatter
  const version = frontmatter.version || filename.replace('.md', '');
  
  // Determine release type from version if not specified
  let releaseType = frontmatter.type;
  if (!releaseType) {
    const versionParts = version.split('.');
    if (versionParts.length >= 3) {
      if (versionParts[0] !== '0' && versionParts[1] === '0' && versionParts[2] === '0') {
        releaseType = 'major';
      } else if (versionParts[2] === '0') {
        releaseType = 'minor';
      } else {
        releaseType = 'patch';
      }
    }
  }
  
  return {
    version,
    date: frontmatter.date || new Date().toISOString().split('T')[0],
    type: releaseType || 'patch',
    title: frontmatter.title || `Version ${version}`,
    sections
  };
}

function generateChangelogData() {
  if (!fs.existsSync(CHANGELOGS_DIR)) {
    console.log('Changelogs directory not found. Creating example files...');
    return;
  }

  const files = fs.readdirSync(CHANGELOGS_DIR)
    .filter(file => file.endsWith('.md') && !file.toLowerCase().includes('readme'))
    .sort((a, b) => {
      // Sort by version number (newer first)
      const versionA = a.replace('.md', '').split('.').map(n => parseInt(n, 10));
      const versionB = b.replace('.md', '').split('.').map(n => parseInt(n, 10));
      
      for (let i = 0; i < 3; i++) {
        if (versionA[i] > versionB[i]) return -1;
        if (versionA[i] < versionB[i]) return 1;
      }
      return 0;
    });

  const changelogData = [];

  for (const file of files) {
    const filePath = path.join(CHANGELOGS_DIR, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const parsedData = parseChangelogFile(content, file);
    changelogData.push(parsedData);
  }

  // Ensure output directory exists
  const outputDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Generate the JavaScript file
  const jsContent = `// Auto-generated file - do not edit manually
// Run 'npm run generate-changelog' to regenerate

export const changelogData = ${JSON.stringify(changelogData, null, 2)};
`;

  fs.writeFileSync(OUTPUT_FILE, jsContent);
  console.log(`Generated changelog data for ${changelogData.length} releases`);
  console.log(`Output: ${OUTPUT_FILE}`);
}

if (require.main === module) {
  generateChangelogData();
}

module.exports = { generateChangelogData, parseChangelogFile }; 