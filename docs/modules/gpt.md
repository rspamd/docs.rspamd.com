---
title: GPT Plugin
---

# Rspamd GPT Plugin

The Rspamd GPT Plugin, introduced in Rspamd 3.9, integrates OpenAI's GPT API to enhance spam filtering capabilities using advanced natural language processing techniques. Here are the basic ideas behind this plugin:

* The selected displayed text part is extracted and submitted to the GPT API for spam probability assessment
* Additional message details such as Subject, displayed From, and URLs are also included in the assessment
* Then, we ask GPT to provide results in JSON format since human-readable GPT output cannot be parsed (in general)
* Some specific symbols (`BAYES_SPAM`, `FUZZY_DENIED`, `REPLY`, etc.) are excluded from the GPT scan
* Obvious spam and ham are also excluded from the GPT evaluation

The last two points reduce the GPT workload for something that is already known, where GPT cannot add any value in the evaluation. We also use GPT as one of the classifiers, meaning that we do not rely solely on GPT evaluation.

For detailed information about this plugin, refer to the [blog post](/misc/2024/07/03/gpt.html).

## Configuration Options

**By default, the GPT Plugin is disabled.** To enable the plugin, add the following command in your Rspamd configuration:

```hcl
gpt {
  enabled = true; # Ensure this line is present to enable the GPT Plugin
}
```

The full list of the plugin configuration options:

```hcl
gpt {
  # Enable the plugin
  enabled = true;

  # LLM provider type: openai (remote) or ollama (local)
  type = "openai";
  
  # Your OpenAI API key (not required for ollama)
  api_key = "xxx";
  
  # Model name (string or a list for ensemble requests)
  model = "gpt-5-mini";

  # Per-model parameters (only for openai model)
  model_parameters = {
    "gpt-5-mini" = {
      max_completion_tokens = 1000,
    },
    "gpt-5-nano" = {
      max_completion_tokens = 1000,
    },
    "gpt-4o-mini" = {
      max_tokens = 1000,
      temperature = 0.0,
    }
  };

  # Maximum number of tokens to request (only for ollama model)
  max_tokens = 1000;
  
  # Temperature for sampling (only for ollama model)
  temperature = 0.0;
  
  # Timeout for requests
  timeout = 10s;
  
  # Prompt for the model (use default if not set)
  prompt = "xxx";
  
  # Custom condition (Lua function)
  condition = "xxx";
  
  # Autolearn if GPT classified
  autolearn = true;

  # Custom Lua function to convert the model's reply. Leave unset to use the
  # built-in parsers for OpenAI / Ollama replies.
  reply_conversion = "xxx";

  # Header to add with the reason produced by GPT (set to null to disable)
  reason_header = "X-GPT-Reason";

  # Skip GPT scan if **any** of these symbols are present (and their absolute
  # weight is equal or above the specified value)
  symbols_to_except = {
    BAYES_SPAM = 0.9;
    WHITELIST_SPF = -1;
  };

  # Trigger GPT scan only when **all** of these symbols are present (and their
  # absolute weight is equal or above the specified value)
  # symbols_to_trigger = {
  #   URIBL_BLOCKED = 1.0;
  # };

  # Check messages that resulted in a `passthrough` action
  allow_passthrough = false;

  # Check messages that already look like ham (negative score)
  allow_ham = false;

  # Request / expect JSON reply from GPT
  json = false;

  # Map of extra virtual symbols that could be set from GPT response categories
  # extra_symbols = {
  #   GPT_MARKETING = {
  #     score = 0.0;
  #     description = "GPT model detected marketing content";
  #     category = "marketing";
  #     group = "GPT";
  #   };
  # };

  # Prefix for Redis cache keys
  cache_prefix = "rsllm";

  # Add `response_format = {type = "json_object"}` to requests (OpenAI only)
  include_response_format = false;

  # API endpoint
  url = "https://api.openai.com/v1/chat/completions";
}
```

### Description of Configuration Options

- **enabled**: Enables the GPT plugin.
- **type**: LLM provider. Accepts `openai` (default) or `ollama`.
- **api_key**: OpenAI API key. Not required for `ollama`.
- **model**: Model name (string) or a list of names to query in parallel.
- **model_parameters**: For each model the required parameters. Required for `openai`.
- **max_tokens**: Maximum number of tokens returned by the model. Required for `ollama`.
- **temperature**: Sampling temperature. Required for `ollama`.
- **timeout**: Network timeout for LLM requests.
- **prompt**: Custom system prompt. If omitted, a sensible default is used.
- **condition**: A Lua function that decides whether a message should be sent to GPT.
- **autolearn**: When `true`, messages classified by GPT are added to Bayes learning (`learn_spam` / `learn_ham`).
- **reply_conversion**: Custom Lua function to convert the model's reply. Leave unset to use the built-in parsers for OpenAI / Ollama replies.
- **reason_header**: Name of the header added with GPT explanation. Set to `null` to disable entirely.
- **symbols_to_except**: Table of symbols that *exclude* a message from GPT processing.
- **symbols_to_trigger**: Table of symbols that must all be present to *trigger* GPT processing.
- **allow_passthrough**: When `true`, messages with `passthrough` action are still evaluated by GPT.
- **allow_ham**: When `true`, messages that already look like ham (negative score) are still evaluated.
- **json**: When `true`, the plugin forces the LLM to return a JSON object and parses it. This can noticeably *reduce answer quality* and is generally **not recommended** unless you have a very deterministic prompt that the model might otherwise ignore.
- **extra_symbols**: Map that allows GPT to set additional virtual symbols based on returned categories.
- **cache_prefix**: Prefix used for Redis cache keys.
- **include_response_format**: Adds OpenAI `response_format = json_object` hint. Useful only together with `json = true`, otherwise unnecessary.
- **url**: API endpoint for the selected provider.

## Example Configuration

Here is a minimal example configuration:

```hcl
gpt {
  enabled = true;
  type = "openai";
  api_key = "your_api_key_here";
  model = "gpt-5-mini";
  model_parameters = {
    "gpt-5-mini" = {
      max_completion_tokens = 1000,
    }
  }
  timeout = 10s;
  reason_header = "X-GPT-Reason";
}
```

## Additional Notes

### JSON vs. Plain-Text Responses
The plugin works best when the model can answer in plain text because it gives the language model more freedom and generally yields better reasoning. Enabling `json = true` (and optionally `include_response_format`) constrains the model to produce a strict JSON object. This often degrades the probability estimate or makes the reply longer than required, so turn it on only if your prompts really need JSON.

### `reason_header`
If `reason_header` is set to a non-empty string, the plugin injects a mail header with the explanation sentence produced by GPT (`X-GPT-Reason` in the examples). This is convenient for debugging or for downstream systems, but remember that the text is untrusted user input and might reveal information to message recipients. Set the option to `null` to disable the header entirely.

### Multiple-Model Ensemble
The `model` option can be a list:

```hcl
model = ["gpt-4o-mini", "gpt-5-nano"];
```

In this case Rspamd queries all listed models in parallel and applies a *consensus* algorithm:
* Each model returns a spam probability.
* If the majority classifies the message as spam with probability > 0.75, the highest spam probability is used.
* If the majority classifies it as ham with probability < 0.25, the lowest ham probability is used.
* Otherwise no GPT symbol is added (no consensus).

This improves robustness and lets you mix cheap fast models with a slower high-quality one.

### Caching Policies
To avoid repeated LLM calls, responses are cached in Redis (if configured). Key facts:
* Key: `<cache_prefix>_<env>_<digest>` where `env` depends on `prompt`, `model`, and `url`, and `digest` is the SHA256 of the examined text part (truncated).
* Default TTL is one hour (`cache_ttl` option accepts seconds).
* Workers coordinate using *pending* markers so that only one request per message is sent even in large clusters.
* Changing the prompt, model list, or endpoint automatically invalidates the cache because they are part of the key.
* You can tune `cache_prefix`, `cache_ttl`, and other cache options directly inside the `gpt {}` block.

## Conclusion

The Rspamd GPT Plugin integrates OpenAI's GPT models into Rspamd, enhancing its spam filtering capabilities with advanced text processing techniques. By configuring the options above, users can customize the plugin to meet specific requirements, thereby enhancing the efficiency and accuracy of spam filtering within Rspamd.
