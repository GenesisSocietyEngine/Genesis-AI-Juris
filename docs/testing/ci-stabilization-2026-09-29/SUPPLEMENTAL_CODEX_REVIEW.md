# Supplemental Codex dependency review

Read-only reviewer: `/root/recover_next_step`, 29 September 2026. This is a supplemental independent Codex source review, not the assigned Claude review. The coordinator remains the sole implementation writer. Review covers the pending manifest/lock diff from `b355caf36fbb27c31a338520fdfeef9649afadc3`.

## Findings and disposition

No blocking source finding. Exactly two of 737 lock entries change (`fast-uri`, `undici`), limited to version, resolved tarball URL and integrity. No entry is added or removed. The existing fast-uri override advances to 3.1.8; a Miniflare-scoped undici override selects 7.29.1. They match patched versions in the upstream [fast-uri advisory](https://github.com/fastify/fast-uri/security/advisories/GHSA-hrr3-gc8f-f4qj) and [undici advisory](https://github.com/nodejs/undici/security/advisories/GHSA-3wwx-pv8p-q78v). The scope follows [npm override semantics](https://docs.npmjs.com/cli/v10/configuring-npm/package-json/#overrides). Miniflare's retained declared `undici: 7.29.0` metadata is expected; the root override controls the installed resolution.

The coordinator's initial npm lock generation also marked 27 unchanged entries as development-only. The reviewer independently asserted that each differed only by `dev: true`: Sharp optional platform packages and `@emnapi/runtime`. Production `next` reaches these via optional `sharp`. Restoring their prior non-dev classification preserves that production optional path and avoids unrelated metadata changes. See [npm package-lock semantics](https://docs.npmjs.com/cli/v10/configuring-npm/package-lock-json/#packages). Actual clean installation and unchanged-lock receipts are still required; source inspection does not substitute for them.

Operational finding: the local preparation script `verify-patches.cjs` is one-shot. Rerunning it after the 27 flags are restored would overwrite the original generated-lock evidence and fail its exact restoration count. Disposition: leave that preparation script and evidence untouched; use a separate verification-only launcher. The resumed launcher does not edit the manifest or lock.

## Limits

This review does not establish successful installation, runtime behavior, audits, build/tests, final-source hosted results, assigned Claude review, main integration or release acceptance. The coordinator records those separately in [REVIEW.md](REVIEW.md). Application UI, wording, navigation and baseline files have no source changes in this slice; no fresh browser acceptance is claimed.
