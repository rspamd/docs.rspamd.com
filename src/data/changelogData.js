// Auto-generated file - do not edit manually
// Run 'npm run generate-changelog' to regenerate

export const changelogData = [
  {
    "version": "3.12.0",
    "date": "2025-06-10",
    "type": "major",
    "title": "Major Release with Enhanced Features and Security Improvements",
    "sections": [
      {
        "title": "Added",
        "items": [
          "**GPT Module Enhancements**: Add Ollama support and token usage logging for OpenAI-compatible APIs",
          "**Fuzzy Storage Improvements**: Add support for separate read and write servers in fuzzy check",
          "**CDB Maps Support**: Allow CDB files as external maps for improved performance",
          "**Contextal Integration**: New plugin to integrate with Contextal platform for advanced threat detection",
          "**Enhanced Logging**: Allow to specify max log tag length for all log messages and log tag in proxy",
          "**Proxy Improvements**: Add keep-alive support, HTTPS backend connections, and extra headers specification",
          "**Redis Version Support**: Allow to specify Redis version for compatibility",
          "**HEIC File Support**: Add HEIC files patterns for better image analysis",
          "**Enhanced Maps Management**: Show all maps status and output content for all maps",
          "**File Upload in WebUI**: Add file upload functionality to Test Selectors",
          "**Convenience Methods**: Add various convenience methods for Lua development",
          "**Enhanced Fuzzy Operations**: Add deletion of specific fuzzy hashes in WebUI",
          "**Improved Error Handling**: Better error messages for multimap invalid types"
        ]
      },
      {
        "title": "Improved",
        "items": [
          "**Security Enhancements**: Critical fix to disable macros and file variables by default in lua-ucl",
          "**Maps Loading**: Fix race condition in maps loading by unlocking backend on switch",
          "**Greylisting**: Improve body hash calculations for better accuracy",
          "**Replies Module**: Rework to consider all recipients and use SMTP ones",
          "**WebUI Updates**: Update Bootstrap, D3 and PrismJS libraries to latest versions",
          "**Lua Logging**: Major improvements to logging output format and complex table key support",
          "**Fuzzy Storage**: Better handling of fuzzy lua callback when there are no shingles",
          "**Milter Headers**: Fix logic error in skip_wanted() function",
          "**Known Senders**: Improved recipients test logic and consistency with replies module",
          "**Maps Management**: Grey out not loaded maps in the Maps table for better visibility",
          "**Redis Integration**: Improve Redis script loading and caching framework usage",
          "**Configuration**: Use safe parsers everywhere except configuration for security",
          "**Build System**: Modernize cmake and improve sanitizers support",
          "**Documentation**: Update API docs for multiple HTTP headers and various other improvements"
        ]
      },
      {
        "title": "Fixed",
        "items": [
          "**Critical Security**: Disable macros and file variables by default in lua-ucl parser",
          "**Race Conditions**: Fix race condition in maps loading by unlocking backend on switch",
          "**Memory Issues**: Fix lua-bit stack buffer overflow vulnerability",
          "**Proxy Crashes**: Prevent crashes when accessing upstream address in self-scan mode",
          "**Maps Management**: Fix maps IDs and static maps description passing",
          "**Fuzzy Storage**: Filter invalid domains in fuzzy extra data",
          "**Redis Integration**: Fix various Redis-related issues and improve script loading",
          "**WebUI Issues**: Fix Fuzzy hashes card close button alignment and map editor modal handling",
          "**Build Issues**: Fix Debian package build and RPM log directory attributes",
          "**Compiler Warnings**: Fix various compile warnings and compatibility issues",
          "**Test Framework**: Fix various test issues and improve test configuration",
          "**Documentation**: Fix writing rules tutorial link and various documentation issues",
          "**URL Lists**: Update default URL for openphish and fix various URL-related issues",
          "**Headers Processing**: Fix header processing in various modules",
          "**Lua Integration**: Fix various Lua-related issues and improve error handling"
        ]
      },
      {
        "title": "Changed",
        "items": [
          "**Configuration**: Use safe parsers everywhere except configuration for enhanced security",
          "**Maps Architecture**: Rework to use locks/loaded per backend for all maps",
          "**Replies Logic**: Consider all recipients and use SMTP ones instead of just From header",
          "**Fuzzy Storage**: Remove servers completely and use `read_servers` for all compatibility",
          "**Logging Format**: Improve format string processing and logging output",
          "**Build System**: Modernize cmake and rework OSDep for better maintainability",
          "**WebUI**: Rework file upload JS implementation and improve user interface",
          "**Documentation**: Update various documentation files and improve API documentation",
          "**Error Handling**: Improve error messages and handling throughout the codebase",
          "**Performance**: Various performance improvements in maps, Redis, and fuzzy operations"
        ]
      },
      {
        "title": "Removed",
        "items": [
          "**Deprecated Features**: Remove various deprecated and unused code paths",
          "**Unused Helpers**: Remove unused cleanTextUpload helper and other obsolete code",
          "**Legacy Support**: Remove compatibility code that is no longer needed"
        ]
      },
      {
        "title": "Security",
        "items": [
          "**Critical Fix**: Disable macros and file variables by default in lua-ucl parser",
          "**Memory Safety**: Fix lua-bit stack buffer overflow vulnerability",
          "**Input Validation**: Improve input validation and error handling throughout",
          "**Configuration Security**: Use safe parsers everywhere except configuration"
        ]
      },
      {
        "title": "Performance",
        "items": [
          "**Maps Loading**: Optimize maps loading with better caching and race condition fixes",
          "**Redis Operations**: Improve Redis script loading and caching framework usage",
          "**Fuzzy Storage**: Better handling of fuzzy operations and storage management",
          "**Memory Usage**: Various memory optimization improvements"
        ]
      },
      {
        "title": "Documentation",
        "items": [
          "**API Documentation**: Update API docs for multiple HTTP headers and various modules",
          "**Tutorial Links**: Fix writing rules tutorial link and other documentation references",
          "**Examples**: Add more examples for Lua HTTP and other modules",
          "**Configuration**: Improve configuration documentation and examples"
        ]
      },
      {
        "title": "Testing",
        "items": [
          "**Test Framework**: Fix various test issues and improve test configuration",
          "**Fuzzy Tests**: Add comprehensive tests for split, read-only, and write-only server modes",
          "**CDB Maps**: Add tests for CDB maps functionality",
          "**HEIC Recognition**: Add tests for HEIC file recognition"
        ]
      }
    ]
  },
  {
    "version": "3.11.1",
    "date": "2024-12-15",
    "type": "minor",
    "title": "Feature Update with Bug Fixes",
    "sections": [
      {
        "title": "Added",
        "items": [
          "GPT: Add ollama support",
          "Allow to hash any Lua types",
          "Allow to use LLM for anonymize",
          "Add ability to not send response_format in gpt plugin to support gpt4all",
          "Allow to store shingles as opaque Lua data",
          "Add 'noop' redis backend for scripts running",
          "Allow multiple lua scripts for fuzzy storage",
          "Support LLM models consensus",
          "GPT: Support reason adding",
          "Add Redis caching framework",
          "Add ability to create timers from Lua"
        ]
      },
      {
        "title": "Improved",
        "items": [
          "Expand Detection of Fake Reply Subjects Across Multiple Languages",
          "Add another acceptable mime type for icon",
          "Respect ipv4 and ipv6 configurations for rbl resolve_ip",
          "Set RBL checks to bool true",
          "Rules regexp url separated and fix no subdomain cases for Google urls",
          "WebUI: Reset dropdown when clearing filters",
          "Pass both the multimap and the rules descriptions for combined multimap on create",
          "Some small fixes to statistics_dump",
          "More features to GPT plugin",
          "Better support for maps and IP-related fixes/improvements in settings",
          "Use caching framework in gpt module",
          "Try to check maps earlier if their expires is too long"
        ]
      },
      {
        "title": "Fixed",
        "items": [
          "Fix transposed results in `rspamadm fuzzy_ping`",
          "connIp is not correctly added to request",
          "Fix Thunderbird for Android marked with FORGED_MUA_THUNDERBIRD_MSGID_UNKNOWN",
          "Fix issue with synchronous Redis calls",
          "Fix some broken links",
          "rbl check_types was missing images",
          "RBL: fix use of `content_urls` and `images` inside `checks`",
          "Use sub_utf8 to strip headers value to not break utf8 strings",
          "Properly close multipart/related boundary when adding text footer",
          "Verify key type to match DKIM signature type",
          "Avoid collision hacks in mempool variables hash",
          "Add expiration for neural ham and spam sets",
          "Properly expire neural ham and spam sets"
        ]
      },
      {
        "title": "Changed",
        "items": [
          "Log queue id with cloudmark analysis string",
          "Allow to disable RBLs via map",
          "Prevent option duplicates in rspamd_stats.pl",
          "Regenerate manpages with recent Pandoc version",
          "Fix spelling errors in libserver",
          "Update JavaScript linters"
        ]
      },
      {
        "title": "Removed",
        "items": [
          "Remove nixspam"
        ]
      }
    ]
  },
  {
    "version": "3.11.0",
    "date": "2024-12-01",
    "type": "major",
    "title": "Major Release with Breaking Changes",
    "sections": [
      {
        "title": "Breaking Changes",
        "items": [
          "**Elasticsearch/OpenSearch Plugin**: Major rework with breaking changes",
          "Added support for Elasticsearch 8 & OpenSearch 2",
          "Added index policy with logs retention",
          "Updated configuration format"
        ]
      },
      {
        "title": "Added",
        "items": [
          "Added LRU cache for last filled ratelimit buckets",
          "Added utilities to manage ratelimit buckets",
          "Added include/exclude logic for headers processing",
          "Added `rspamadm mime strip` command for attachments removal",
          "Added new message anonymization capabilities",
          "Added more ways to extend Rspamd configuration, including `lua.local.d` folder"
        ]
      },
      {
        "title": "Improved",
        "items": [
          "Improved address rotation algorithm for upstream selection",
          "Replaced fastutf with simdutf for better architecture support and performance",
          "Reworked symbol description display on hover in WebUI",
          "Improved keyboard accessibility in WebUI",
          "Enhanced symbol rendering in WebUI",
          "Improved handling of DNS limits in SPF module",
          "Improved GPT module JSON parsing",
          "Multiple performance optimizations"
        ]
      },
      {
        "title": "Fixed",
        "items": [
          "Fixed ARC-Seal signing issues",
          "Fixed RFC 2047 header encoding",
          "Fixed issues with dynamic keys in fuzzy storage",
          "Fixed TCP connection handling with cumulative timeouts",
          "Fixed multiple phishing detection false positives",
          "Fixed DMARC structured headers encoding"
        ]
      },
      {
        "title": "Changed",
        "items": [
          "Skip extra RBL checks when Received IP matches From IP",
          "Multimap now uses only distinct text parts for content matching",
          "Various configuration and logging improvements"
        ]
      }
    ]
  }
];
