#!/bin/bash

# Clean up any existing versioned directories
rm -rf versioned_docs
rm -rf versioned_sidebars

# Create the versions.json file
echo '["3.11.2"]' > versions.json

# Create versioned directories
mkdir -p versioned_docs/version-3.11.2
mkdir -p versioned_sidebars

# Copy current docs to versioned directory
cp -r docs/* versioned_docs/version-3.11.2/

# Create versioned sidebar JSON file
cat > versioned_sidebars/version-3.11.2-sidebars.json << 'EOF'
{
  "docs": [
    "index",
    "faq",
    {
      "type": "category",
      "label": "About",
      "link": {
        "type": "doc",
        "id": "about/index"
      },
      "items": [
        "about/features",
        "about/comparison",
        "about/performance"
      ]
    },
    {
      "type": "category",
      "label": "Configuration",
      "link": {
        "type": "doc",
        "id": "configuration/index"
      },
      "items": [
        "configuration/settings",
        "configuration/metrics",
        "configuration/logging",
        "configuration/options",
        "configuration/composites",
        "configuration/maps",
        "configuration/selectors",
        "configuration/statistic",
        "configuration/redis",
        "configuration/upstream",
        "configuration/ucl"
      ]
    },
    {
      "type": "category",
      "label": "Workers",
      "link": {
        "type": "doc",
        "id": "workers/index"
      },
      "items": [
        "workers/normal",
        "workers/controller",
        "workers/rspamd_proxy",
        "workers/fuzzy_storage"
      ]
    },
    {
      "type": "category",
      "label": "Modules",
      "link": {
        "type": "doc",
        "id": "modules/index"
      },
      "items": [
        "modules/antivirus",
        "modules/arc",
        "modules/asn",
        "modules/bayes_expiry",
        "modules/chartable",
        "modules/clickhouse",
        "modules/dcc",
        "modules/dkim",
        "modules/dkim_signing",
        "modules/dmarc",
        "modules/elastic",
        "modules/emails",
        "modules/external_relay",
        "modules/external_services",
        "modules/force_actions",
        "modules/fuzzy_check",
        "modules/gpt",
        "modules/greylisting",
        "modules/hfilter",
        "modules/history_redis",
        "modules/ip_score",
        "modules/known_senders",
        "modules/maillist",
        "modules/metadata_exporter",
        "modules/metric_exporter",
        "modules/mid",
        "modules/milter_headers",
        "modules/mime_types",
        "modules/multimap",
        "modules/mx_check",
        "modules/neural",
        "modules/once_received",
        "modules/phishing",
        "modules/ratelimit",
        "modules/rbl",
        "modules/regexp",
        "modules/replies",
        "modules/reputation",
        "modules/rspamd_update",
        "modules/spamassassin",
        "modules/spamtrap",
        "modules/spf",
        "modules/surbl",
        "modules/trie",
        "modules/url_redirector",
        "modules/whitelist"
      ]
    },
    {
      "type": "category",
      "label": "Lua API",
      "link": {
        "type": "doc",
        "id": "lua/index"
      },
      "items": []
    },
    {
      "type": "category",
      "label": "Tutorials",
      "link": {
        "type": "doc",
        "id": "tutorials/index"
      },
      "items": [
        "tutorials/quickstart",
        "tutorials/migration",
        "tutorials/migrate_sa",
        "tutorials/scanning_outbound",
        "tutorials/fuzzy_storage",
        "tutorials/redis_replication",
        "tutorials/stunnel_setup",
        "tutorials/integration",
        "tutorials/feedback_from_users_with_IMAPSieve",
        "tutorials/site_contributing"
      ]
    },
    {
      "type": "category",
      "label": "Developers",
      "link": {
        "type": "doc",
        "id": "developers/architecture"
      },
      "items": [
        "developers/architecture",
        "developers/protocol",
        "developers/sync_async",
        "developers/writing_rules",
        "developers/writing_tests",
        "developers/examples"
      ]
    },
    {
      "type": "category",
      "label": "Other",
      "items": [
        "other/rspamadm",
        "other/gtube_patterns",
        "other/usage_policy"
      ]
    }
  ]
}
EOF

echo "Versioning completed manually. You can now start the server with 'npm start'"
