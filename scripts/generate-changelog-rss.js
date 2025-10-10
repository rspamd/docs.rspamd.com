#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const CHANGELOGS_DIR = path.join(__dirname, '..', 'changelogs');
const OUTPUT_FILE = path.join(__dirname, '..', 'static', 'rss', 'changelog.xml');
const SITE_URL = 'https://rspamd.com';

function escapeXml(unsafe) {
  if (typeof unsafe !== 'string') {
    return '';
  }
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

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

function generateRssDescription(release) {
  let description = `<![CDATA[<h2>Rspamd ${release.version} - ${escapeXml(release.title)}</h2>`;
  
  for (const section of release.sections) {
    description += `<h3>${escapeXml(section.title)}</h3><ul>`;
    for (const item of section.items) {
      description += `<li>${escapeXml(item)}</li>`;
    }
    description += '</ul>';
  }
  
  description += ']]>';
  return description;
}

function generateRssItem(release) {
  const pubDate = new Date(release.date).toUTCString();
  const link = `${SITE_URL}/changelog#version-${release.version.replace(/\./g, '-')}`;
  const guid = `${SITE_URL}/changelog/${release.version}`;
  
  return `    <item>
      <title>Rspamd ${escapeXml(release.version)} - ${escapeXml(release.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="false">${guid}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${generateRssDescription(release)}</description>
      <category>${escapeXml(release.type)}</category>
    </item>`;
}

function generateChangelogRss() {
  if (!fs.existsSync(CHANGELOGS_DIR)) {
    console.error('Changelogs directory not found.');
    process.exit(1);
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
    })
    .slice(0, 20); // Limit to 20 most recent releases

  const releases = [];

  for (const file of files) {
    const filePath = path.join(CHANGELOGS_DIR, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const parsedData = parseChangelogFile(content, file);
    releases.push(parsedData);
  }

  const now = new Date().toUTCString();
  const items = releases.map(generateRssItem).join('\n');

  const rssContent = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Rspamd Changelog</title>
    <link>${SITE_URL}/changelog</link>
    <description>Release notes and changelog for Rspamd spam filtering system</description>
    <language>en</language>
    <lastBuildDate>${now}</lastBuildDate>
    <atom:link href="${SITE_URL}/rss/changelog.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;

  // Ensure output directory exists
  const outputDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_FILE, rssContent);
  console.log(`Generated RSS feed for ${releases.length} releases`);
  console.log(`Output: ${OUTPUT_FILE}`);
}

if (require.main === module) {
  generateChangelogRss();
}

module.exports = { generateChangelogRss };

