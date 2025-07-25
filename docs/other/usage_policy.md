---
title: Services acceptable use policy
---


# Rspamd fuzzy feed, DNSBL and site usage policies

If you use Rspamd [fuzzy feeds](/modules/fuzzy_check) and/or Rspamd URLs/Emails black lists, it is important to understand the current limits and whether you are eligible for free usage.

This information applies to fuzzy storage feeds, DNS lists (specifically URLs and Emails blacklists), and the usage of rspamd.com for map distribution. It may be expanded in the future to include other intelligence resources provided by rspamd.com.

## Free usage policy

We offer infrastructure and algorithms to collect spam message data and convert spam waves into useful sets of blocked fuzzy hashes, URLs, and emails. Both hardware and human resources are required for these operations, so we have established "fair usage" policies for these services.

To qualify for free usage of the feeds, you must meet the following conditions: 

1. Your use of the data is **non-commercial**

    **and**

2. Your query volume is less than **100,000 queries per day**

If you qualify (1) and (2) but still got blocked then please contact us by using our email address: <mailto:hi@rspamd.com>

Please note that there are several situations in which you may be rate-limited:

* A rate limit (indicated by the symbols `FUZZY_RATELIMIT` or `FUZZY_BLOCKED`) may be triggered if there is a short-term spike in your email traffic. Typically, this is automatically lifted once the traffic rate decreases over time.
* You may also be blocked if there is an overlap with another user utilizing the fuzzy service. For instance, we may permanently block networks of large cloud providers, such as EC2 or Azure, due to a high volume of abusive traffic and the difficulty of identifying specific responsible IP addresses.

## Vendors policies

Rspamd map checks typically run quietly in the background. When servers are selected, they will usually stay in the configuration indefinitely. If the client traffic causes problems for the server, it can be difficult to address if not carefully planned for in advance.

For example, there was an [incident](https://www.reddit.com/r/synology/comments/f5jczp/mailplus_server_and_rspamdcom/?rdt=48389) that caused troubles for both Rspamd project and the vendor's users.

Hence, we are kindly asking to [contact us](mailto:hi@rspamd.com) before embedding Rspamd in any sort of commercial or open source project. In this way, we could decide about the strategy to avoid issues with the embedded solution in future.

## Premium service

If you do not meet these criteria, you can either stop using this service or contact us for a [premium service](https://www.rspamd.com/#commercial) that covers our costs for providing free access. Please use the following email address for inquiries: <mailto:hi@rspamd.com>

In addition, the premium service also offers more hashes and longer retention policies, as well as lower latency between a spamtrap hit and the fuzzy hash being placed in storage.

This service also includes rsync-based access to the URLs and Emails feeds, allowing you to use your own [rbldnsd](https://github.com/rspamd/rbldnsd) to serve this data with no delays for your email scanners.
