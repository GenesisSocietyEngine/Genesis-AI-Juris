# CaseVant v113 production verification — 6 October 2026

## Outcome
Published a verified successor on the existing Site, not a new project. Apex migration is live and verified. The full two-host migration remains incomplete because www DNS is outside the connected Sites controls and still serves the old Apache host.

- Site: appgprj_6a88a26d2f808191aa076b9fcd8dbce6 (CaseVant by Falcon-Merlin Group)
- Version: 113
- Version ID: appgprj_6a88a26d2f808191aa076b9fcd8dbce6~appgver_429f2ec502a0819180a6a47b1480e404
- Deployment: appgdep_6ac5173569d0819195043bdef92fb81b; succeeded
- Exact packaged/deployed source: 7e13f6201831ce4dfd4880796af025b836c6bff5
- Environment revision: 42, preserved; audience: public, preserved
- No changes to D1/R2 bindings, historical migrations, authentication configuration or existing data.

## Source provenance
Reviewed requested PR #90 head 46c198a0b2cff7975c31d4611d363ad83931b43a. Its audit failed, so it was not deployed unchanged. Preserved production v112's newer CaseVant training assets and repaired release audit findings (source-map-js 1.2.2, Sharp 0.35.5) plus stale tests expecting the older training filenames.

The Sites source above is a fast-forward successor of v112 and contains the requested PR head as an ancestor. GitHub review head 2d1b7b39569ab418a86a83eedfb4178a35ddc2ae has the exact same Git tree bcf67f32667a74b9679458d36435973db047870e; the histories differ because GitHub connector commits and the existing Sites source history differ. PR #91 merged through ordinary controls as 28434a06b9aa9aa9e2d7d8af12303e3d74ac52cb. No older main was substituted.

## Release evidence
On the exact clean Sites source: pinned Node 22.23.2/npm 10.9.8; lock-enforcing install; migration-history verification; strict typecheck; lint; parity lock; verified build; full suite (1200 passed, zero failed, 3 skipped); packaged browser/RSC/SSR tax execution; packaged production Worker login/report history and fail-closed checks; both complete and production dependency audits (zero vulnerabilities).

GitHub Root Web and PDF run 37488459882 succeeded on the identical reviewed source tree, including all 47 approved Windows PDF baselines and tax-v2 PDF verification. No failing release gate was bypassed. Unrelated native iOS workflows were still running at the final web release check; they were not used as evidence of web verification.

## Live HTTP verification
All requests below returned HTTP 200 after publication:
- /, /studio, /templates, /help/studio-demo: distinct apex self-canonicals and CaseVant title/Open Graph/Twitter metadata.
- /robots.txt: text/plain, actual crawl policy, not an HTML shell; permits public routes and excludes private/account/workspace/API surfaces.
- /sitemap.xml: text/xml, valid XML with exactly the four intended public apex URLs.
- /account, /account/reset, /matters, /organizations, /invitations, /canopy: noindex/nofollow metadata and X-Robots-Tag noindex, nofollow, noarchive.
- /studio?custom_case=1: X-Robots-Tag noindex, nofollow, noarchive.

Browser smoke after publish: landing and migration-recovery guide load; Canopy opens into Studio; analytical PDF preview successfully generated; nine Templates render; current CaseVant training media loads with duration 600 seconds, readyState 4 and no media error. Authenticated save/reopen and organization isolation were verified by automated tests with synthetic data, not a production customer session.

## Remaining www DNS blocker
Apex casevant.pro and legacy studio.falcon-merlin.com are active with active TLS on this existing Site. www.casevant.pro is registered to the same Site but pending DNS/TLS validation. Live www still returns HTTP 200 from Apache/Varnish, with no apex redirect. The packaged Worker permanently redirects www to fixed https://casevant.pro with status 308 while preserving path/query; this is verified in the packaged runtime, not yet on live www.

Required DNS records at the domain provider:
- CNAME www.casevant.pro -> custom-domains.chatgpt.site.
- TXT _openai-site-verification.www.casevant.pro -> openai-site-verification=3YuoxvxMU6yOJwqqzyLdosbjysGayn6yDd9TIa9Twb0
- TXT _cf-custom-hostname.www.casevant.pro -> f96db9b5-70fe-45d1-a9f3-aac0498eead0

After DNS is changed, refresh custom domain appgdom_6ac50f521d20819194b16053ae0fbc38 on the same Site, wait for active TLS, then verify live www / and /studio?lang=ru redirect permanently to the apex before calling the full migration complete.

This documentation-only follow-up does not alter the deployed source or create another Site version.
