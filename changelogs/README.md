# Changelog System

This directory contains individual Markdown files for each release. The changelog system automatically reads these files and generates a beautiful React-based changelog page.

## File Format

Each changelog file should be named with the version number: `X.Y.Z.md` (e.g., `3.11.0.md`)

### File Structure

```markdown
---
version: "3.11.0"
date: "2024-12-01"
type: "major"
title: "Major Feature Release"
---

## Added
- New feature 1
- New feature 2

## Changed
- Changed item 1
- Changed item 2

## Fixed
- Bug fix 1
- Bug fix 2

## Security
- Security fix 1
```

### Front Matter Fields

- **version**: Version number (optional, will be inferred from filename)
- **date**: Release date in YYYY-MM-DD format
- **type**: Release type (`major`, `minor`, or `patch`)
- **title**: Human-readable release title

### Supported Section Types

The following section types are supported and will be automatically styled:

- **Added**: New features
- **Changed**: Changes to existing functionality
- **Improved**: Improvements to existing functionality
- **Fixed**: Bug fixes
- **Security**: Security-related fixes
- **Deprecated**: Soon-to-be removed features
- **Removed**: Now removed features

## Release Types

The system automatically categorizes releases based on semantic versioning:

- 🚀 **Major Release** (X.0.0): Breaking changes, major new features
- ✨ **Feature Release** (X.Y.0): New features, backward compatible
- 🐛 **Bug Fix Release** (X.Y.Z): Bug fixes, security patches

## How to Add a New Release

1. Create a new Markdown file in this directory: `changelogs/X.Y.Z.md`
2. Add the front matter and content following the format above
3. Run `npm run generate-changelog` to update the changelog data
4. The new release will automatically appear on the changelog page

## Scripts

- `npm run generate-changelog`: Regenerates the changelog data from Markdown files
- The script automatically runs when you build the site

## Features

- 📱 **Mobile Responsive**: Works perfectly on all devices
- 🎨 **Beautiful Design**: Modern card-based layout with smooth animations
- 🔍 **Filter by Type**: Filter releases by major, minor, or patch
- 📖 **Expandable Entries**: Click to expand/collapse release details
- 🏷️ **Semantic Versioning**: Automatic release type detection
- 🎭 **Dark Mode**: Respects Docusaurus theme settings 