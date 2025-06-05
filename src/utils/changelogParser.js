export function parseChangelogFile(content, filename) {
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