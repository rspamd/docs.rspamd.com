---
title: Getting Started with Rspamd
sidebar_position: 1
---

# Getting Started with Rspamd

Welcome to your Rspamd journey! This section is designed to get you from complete beginner to effectively filtering spam in real-world scenarios.

## Choose Your Path

Different users have different needs and starting points. Choose the path that matches your situation:

### 🆕 I'm New to Rspamd
**Recommended path**: Understand → Install → Configure → Test

1. **[Understanding Rspamd](understanding-rspamd)** - Build the mental model first
2. **[Installation Guide](installation)** - Choose the right installation method  
3. **[First Success Setup](first-setup)** - Get working spam filtering in 30 minutes
4. **[Configuration Fundamentals](/guides/configuration/fundamentals)** - Learn what to configure

**Time investment**: 2-3 hours for basic working setup

### 🔄 I'm Migrating from Another Solution
**Recommended path**: Compare → Plan → Migrate → Optimize

1. **[Migration Planning](migration-planning)** - Understand differences and plan your migration
2. **[SpamAssassin Migration](/tutorials/migrate_sa)** - Specific migration guide
3. **[Configuration Mapping](configuration-mapping)** - Map your existing rules
4. **[Testing and Validation](testing-migration)** - Ensure everything works

**Time investment**: 4-6 hours for complete migration

### ⚡ I Need Quick Fixes
**Recommended path**: Diagnose → Apply → Verify

1. **[Common Problems](/troubleshooting/common-problems)** - Quick solutions to frequent issues
2. **[Emergency Fixes](/troubleshooting/emergency-fixes)** - Stop spam floods immediately  
3. **[Performance Issues](/troubleshooting/performance)** - Speed up slow Rspamd
4. **[Configuration Recovery](/troubleshooting/recovery)** - Fix broken configurations

**Time investment**: 30 minutes to 2 hours per issue

### 🚀 I Want to Optimize
**Recommended path**: Analyze → Tune → Monitor → Iterate

1. **[Performance Analysis](/optimization/analysis)** - Understand your current performance
2. **[Effectiveness Tuning](/optimization/effectiveness)** - Improve spam catch rates
3. **[Resource Optimization](/optimization/resources)** - Reduce CPU and memory usage
4. **[Advanced Configuration](/optimization/advanced)** - Custom rules and complex setups

**Time investment**: Ongoing optimization process

## What You'll Learn

By following this getting started section, you'll understand:

### Core Concepts
- ✅ How Rspamd analyzes emails and makes decisions
- ✅ What you can configure and why it matters
- ✅ The relationship between modules, symbols, scores, and actions
- ✅ How to choose the right tools for your specific tasks

### Practical Skills  
- ✅ Install and configure Rspamd for your environment
- ✅ Integrate with your mail server (Postfix, Exim, etc.)
- ✅ Set appropriate spam filtering thresholds
- ✅ Test and validate your configuration
- ✅ Monitor and maintain your spam filtering system

### Real-World Application
- ✅ Configure for small business vs. enterprise scenarios
- ✅ Handle migration from existing spam filtering solutions
- ✅ Troubleshoot common problems quickly
- ✅ Optimize for both effectiveness and performance

## Prerequisites

Before starting, ensure you have:

- **Basic Linux administration skills** - comfort with command line, file editing
- **Email system understanding** - familiarity with MTAs, SMTP, email headers
- **Root access** to your mail server (or appropriate sudo permissions)
- **Time to test** - don't deploy directly to production without testing

## Learning Philosophy

Our documentation follows a **progressive disclosure** approach:

1. **Start with concepts** - Understand before implementing
2. **Build incrementally** - Working system first, optimization later
3. **Learn by doing** - Practical examples with real configurations
4. **Connect to reference** - Link to detailed technical documentation when needed

## Support and Community

As you work through these guides:

- **Join our community** - Get help from other users and developers
- **Report issues** - Help us improve the documentation
- **Share your experience** - Contribute scenarios and solutions
- **Stay updated** - Follow changes and new features

## What's Different About This Guide?

Traditional Rspamd documentation has been reference-focused. This new structure:

- **Answers "how to accomplish X"** instead of just "what parameter Y does"
- **Provides decision frameworks** to help you choose the right approach
- **Includes real-world scenarios** beyond basic setup examples
- **Connects related concepts** so you understand how pieces fit together
- **Offers multiple learning paths** for different user needs

## Ready to Start?

Choose your path above, or if you're unsure, start with **[Understanding Rspamd](understanding-rspamd)** to build the foundation you'll need for everything else.

Remember: **effective spam filtering is a journey, not a destination**. Start with the basics, get a working system, then iterate and improve based on your actual email patterns and requirements.