# Security policy

## Reporting a vulnerability

Report privately. Do not open a public issue for a security problem.

Use GitHub private vulnerability reporting:
<https://github.com/bitcoinuniverseio/op-return/security/advisories/new>

Please include:

- what you found, and the page, script or rule it affects;
- the exact `scriptPubKey` hex or transaction shape that demonstrates it, where relevant;
- what an attacker gains;
- anything you already tried that did not work.

You will get an acknowledgement. Please give us a reasonable window to investigate and fix
before any public disclosure.

## What is in scope

This repository is a documentation site. The security relevant surface is small but real:

- **Incorrect protocol rules.** A rule stated wrongly here could lead an implementer to
  accept a payload that the authoritative readers reject, or the reverse. Report these.
- **Incorrect capability claims.** If this site says a Bitcoin Universe product supports an
  action that it does not, or the reverse, that is a reportable defect.
- **The decoder.** `decoder.js` runs entirely in the reader's browser. Report anything that
  makes it produce a wrong classification, or anything that would cause it to transmit,
  store or log pasted input. It must never do any of those.
- **The site itself.** Injection, unsafe DOM construction, or any request to a third party
  origin. The site is designed to make zero external requests.

## What is not in scope

- Vulnerabilities in Bitcoin Core, in third party wallets, or in protocols that originated
  outside this organisation. Report those to their own maintainers.
- The indexers and backend services themselves. Those live in their own repositories and
  have their own reporting paths. If your finding concerns one of them, say so in the
  advisory and it will be routed.
- Missing hardening headers on GitHub Pages, which this repository does not control.

## Handling of pasted data

The decoder page states, and the implementation enforces, that pasted script hex is never
logged, stored or transmitted. There is no analytics, no telemetry and no third party
script anywhere on this site. A change that breaks that property is a security defect.
