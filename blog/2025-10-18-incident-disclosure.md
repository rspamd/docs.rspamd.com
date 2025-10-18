---
slug: 2025/10/18/incident-disclosure
title: Incident Disclosure - Rspamd Public Service Temporary Suspension
authors: rspamd
tags: [incident, announcement, service disruption]
---

# Incident Disclosure: Rspamd Public Service Temporary Suspension Due to Hosting Provider Actions

On Saturday, October 18th, 2025, the public Rspamd DNSBL RBL feed and what's more important **public fuzzy** service was disrupted due to an unexpected server block by our hosting provider, Hetzner. This interruption affected hundreds of thousands of users and likely led to increased volumes of spam for many legitimate email services worldwide.

<!--truncate-->

## What Happened

- Our monitoring detected service degradation early Saturday, followed by Hetzner's notification that our server would be blocked due to "suspected port scan attacks."
- Rspamd's service responds to legitimate external requests on port 11335 as part of its normal operation—the traffic flagged was fully expected and non-malicious.
- Despite prior communications clarifying this issue (with Hetzner support involved on three separate occasions), our server was nevertheless blocked following a provider-side false positive.
- Although Hetzner's support eventually agreed that the block was in error and restored service, we received further claims that network activity from our side (including connections to resolvable, legitimate mail service IPs like `gateway.pc5.atmailcloud.com` and `ap02psmtp.brightspace.com`) was improper, citing "unrouted addresses" — a claim contradicted by publicly available DNS records and usage reports.

## Why This Matters

- This ongoing false positive detection and inflexible incident response directly impacted the reliability of a widely-used open source project, with real-world effects for large-scale email filtering, spam defense, and downstream email service providers.
- We have complied with all incident forms, engaged in dialogue multiple times, and transparently reported our findings. Unfortunately, misinterpretation of perfectly ordinary and legitimate network traffic resulted in a block that, while now lifted, has forced us to disable certain public-facing Rspamd services to avoid future risk.

## Our Next Steps

- We are reviewing our hosting provider relationship and will migrate to a more robust and responsive provider to avoid future interruptions.
- Public access to some Rspamd services will remain suspended until a solution that meets both our standards and availability requirements is fully in place.

## Conclusion

This episode highlights the critical importance of technical nuance and responsive incident handling in the infrastructure supporting public open source projects.

We regret the inconvenience to our user base and assure everyone that maintaining reliable, high-quality service for the global community remains our top priority.

Thank you for your understanding and support.

---

*For questions or concerns, please reach out through our [support channels](/support).*

