// Auto-generated file - do not edit manually
// Run 'npm run generate-changelog' to regenerate

export const changelogData = [
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
