---
title: Save rejected module
---

# Save rejected module

This module saves all rejected emails to a directory. It is intended for
debugging, especially when setting up a new server.

The module runs in `idempotent` stage and the MTA is still instructed to reject
the mail. Hovever Rspamd will save the mail in a directory so it is possible to
learn it as HAM in case of false positives.

The module is disabled by default. Currently the only other parameter beside
enabling the module is to set the directory used to save the mail.
```hcl
# local.d/save_rejected.conf:
enabled = true;
base_path = "/var/lib/rspamd/rejected";
```

The names of the files created are similar to the names used by Maildir.
The first part is the unix timestamp, followed by a random string, followed by
the hostname.

It is necessary to create the directory and set the appropriate permissions:
```shell
mkdir -m 0700 /var/lib/rspamd/rejected
chown _rspamd:_rspamd /var/lib/rspamd/rejected
```

Furthermore, it might be useful to have a systemd timer for cleanup:
```ini
# /etc/systemd/system/clean_rejected.timer
[Unit]
Description=Clean old rejected mails

[Timer]
OnCalendar=hourly
Persistent=true

[Install]
WantedBy=timers.target
```

An associated service that deletes stored emails after one day:
```ini
# /etc/systemd/system/clean_rejected.service
[Unit]
Description=Clean old rejected mails

[Service]
User=_rspamd
ExecStart=/usr/bin/find /var/lib/rspamd/rejected -type f -mmin +1440 -delete
```
