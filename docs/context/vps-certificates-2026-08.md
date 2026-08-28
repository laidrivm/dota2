# VPS certificates — what the 2026-08-28 fix established

A save-point for a later session working on the deployment host's TLS. Not a
source of truth: the procedure that survived this is in `README.md` §*Bootstrapping
a host* step 2, and that is what to follow. This file holds the measurements
behind it and the dead ends, so neither is paid for twice.

The host is shared — see the deployment notes in `README.md` and remember that
`nginx-proxy` terminates TLS for every site on the machine, not only d2ass's.

## What was established

**`--standalone` cannot renew behind the proxy, and fails silently.** The
authenticator binds port 80, which `nginx-proxy` holds permanently, so the
first issue succeeds and every renewal after it fails. Measured 2026-08-27:
four of six certificates were `authenticator = standalone`, `certbot renew`
reported `2 renew failure(s)`, and `fizzbuzz.digital` and `mellon.sh` had been
serving expired certificates since 2026-08-21 — six days, noticed by nobody
and by no alert.

**One Cloudflare token already covered all three zones.** Evidence, in order of
strength: the `laidrivm.com` certificate is `dns-cloudflare`, renews cleanly,
and its SAN list carries `mta-sts.fizzbuzz.digital` and `autoconfig.mellon.sh`
— so the token had been editing all three zones for months. Confirmed before
touching production with `certbot certonly --dry-run` against staging for
`mellon.sh` and `fizzbuzz.digital`; both succeeded.

**`certbot certonly --dry-run` does not write the renewal config.** Measured:
after a dry run passing `--authenticator dns-cloudflare` explicitly,
`/etc/letsencrypt/renewal/mellon.sh.conf` still read `authenticator =
standalone`. So the plugin can be proven against a zone without committing the
lineage to it.

**Editing `renewal/<name>.conf` by hand is a valid way to switch authenticator.**
Used for the two certificates that were not yet due, to avoid issuing for no
reason: change `authenticator`, add `dns_cloudflare_credentials` and
`dns_cloudflare_propagation_seconds`. Verified by `certbot renew --cert-name
<name> --dry-run` for each.

**Docker resolves a file bind mount once, at container start.** So a container
that mounts `…/live/<name>/fullchain.pem` — a symlink into `archive/` — keeps
reading the old target after a renewal repoints it, and no reload can fix that;
only a restart re-resolves the mount. Measured directly rather than assumed: a
throwaway container mounting a symlinked file still read `OLD-CERT` after the
symlink was repointed to a file containing `NEW-CERT`. A container mounting the
whole `/etc/letsencrypt` directory is unaffected, because the symlink is
resolved inside the container per open.

That distinction is what decides reload against restart per consumer:
`nginx-proxy` mounts the directory and takes `nginx -s reload`; `blog` mounts
two files and needs `docker restart`. The installed hook reloads the proxy for
every lineage and restarts the `laidrivm.com` consumers only — it names them,
so read it rather than this — gated on a `*/laidrivm.com` pattern that a
sibling like `d2ass.laidrivm.com` does not match. It lives at
`/etc/letsencrypt/renewal-hooks/deploy/reload-consumers.sh` on the host and
carries its reasoning in comments.

**`certbot renew --dry-run` does not run deploy hooks.** `--run-deploy-hooks`
is what exercises them. A dry run that passes therefore says nothing about
whether delivery works.

**Host facts, read off the machine rather than recalled.** certbot 2.9.0 from
apt, with `python3-certbot-dns-cloudflare`; the credentials file holds one key,
`dns_cloudflare_api_token`, at mode 600; renewal is scheduled by
`certbot.timer` (enabled) and an `/etc/cron.d/certbot` entry, both of which
come from the Debian package and neither of which a `pip` install provides.

## Ruled out

**A browser showing the old certificate after the fix is not a server
problem.** Checked when it happened: the `live/` symlink pointed at the new
`fullchain2.pem`, only two nginx workers existed and both postdated the reload,
and `openssl s_client` returned the new serial over both IPv4 and IPv6. Two
things explain it and neither needs investigating again — nginx holds
certificates in memory until reloaded, so there was a window between issuing
(23:47 UTC) and the reload (00:07 UTC) in which the files were new and the
served certificate was not; and a browser reuses its connection and resumes its
TLS session, so a tab opened before the reload keeps showing what it was
established with. `openssl s_client` is the check that ignores both.

**Cloudflare proxying is not involved.** The zone's orange cloud is off per
`README.md` step 1, and the DNS API works regardless of it.

## Where it stopped

The deploy hook has never been fired by certbot. It was exercised by invoking
it directly with `RENEWED_LINEAGE` set — both branches, the matching lineage
and a non-matching one — which proves the script but not the path certbot takes
to it. The check that would close this is

```sh
certbot renew --dry-run --run-deploy-hooks
```

It was not run because it restarts live containers on a shared host, so it
wants a chosen moment rather than an idle one. The unattended path is likewise
unproven end to end; `certbot.timer` runs twice daily and the certificates now
renew around 2026-10-13 at the earliest, which is the next natural observation.

The renewal configs as they stood before the change are at
`/root/letsencrypt-renewal-backup-20260827T234644Z` on the host.
