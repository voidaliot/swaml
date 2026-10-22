# CI security and privacy audit

Audit date: 22 October 2026. Baseline: release commit
`f6598747c91aeeb09d1131930e9eac47b0aa3abd`. Scope: public repository history,
Actions workflows/settings, publication assets, recent public run logs and build
dependencies. This is a bounded audit, not a guarantee that no secret or defect
exists.

## Findings and changes

| Finding | Evidence and resolution |
| --- | --- |
| P2: vulnerable PDF build dependencies | `pip-audit` 2.10.1 reported 107 advisory matches: Mistune 3.1.3 (29), pypdf 6.10.0 (54), Pillow 12.3.0 (24). Some concern denial of service or plugin paths that this project does not use; these are dependency matches, not 107 demonstrated application exploits. CI now installs Mistune 3.4.0, pypdf 6.21.2 and Pillow 13.0.0 through `scripts/ci-pdf-requirements.txt`; the complete resolved environment has zero known matches. Published dependency records and artifacts are immutable. Their old toolchain is no longer installed or executed by CI. |
| P2: mutable action references | Every action used a major-version tag. Full upstream commit pins now cover checkout, runtime setup, artifact upload and deployment. The Pages composite was replaced because it invokes a mutable `upload-artifact@v4` internally even when its outer action is pinned. |
| P2: unrestricted publication file boundary | The old Pages upload recursively archived the output and dereferenced links. The new check accepts only the production entry point, favicon, six explicit downloads and JS/CSS bundles. Unexpected files/directories, source maps, draft images, symlinks, junctions, hard links and special files fail before upload. The archive command does not dereference links. Three focused regressions exercise acceptance, extra-file rejection and linked-file rejection. |
| P3: unnecessary checkout credential retention | Checkout previously retained the scoped token in Git configuration during repository/dependency execution. All checkouts now use `persist-credentials: false`. Tokens were already read-only for builds; only the isolated Pages deploy job has `pages: write` and `id-token: write`. No token leak was found. |
| P3: excess execution and artifact retention | Branch pushes and PR events duplicated the Node matrix and publication work. Jobs now have explicit time limits, stale checks are cancelled, PR jobs upload no artifacts, and deployment artifacts expire after one day. Dependency installation disables lifecycle scripts; the required first-party build commands run explicitly. |

The action changes follow [GitHub's secure-use guidance](https://docs.github.com/en/actions/reference/security/secure-use).
Representative upstream dependency advisories are
[Mistune link-title parsing](https://github.com/lepture/mistune/security/advisories/GHSA-8mp2-v27r-99xp),
[pypdf cross-reference parsing](https://github.com/py-pdf/pypdf/security/advisories/GHSA-jj6c-8h6c-hppx),
and [Pillow GIF sizing](https://github.com/python-pillow/Pillow/security/advisories/GHSA-65qm-jvmh-6pqg).

## Minimum test policy

| Event | Required work |
| --- | --- |
| Ordinary PR, push to `main`, or manual language check | One Node 22 job: the complete language gate, three artifact-boundary tests, production site build and artifact validation. |
| Publication tooling/assets change, or manual pre-release check | Additional Node 24 language tests, Windows notation check and current/historical PDF integrity checks with maintained dependencies. |
| Manual Pages deployment from the default branch | Build and validate the actual site, upload the checked artifact, then deploy in a separate job. |

A normal PR previously started five jobs; an update to its same-repository branch
also started four duplicate push jobs. It now starts one job. The 202 language
tests take about 3.4 seconds locally and cover distinct contracts, including the
fourteen review regressions. They are retained and run once in routine CI, rather
than four times across two events and two Node versions. The site reuses that
job's compiled language core. Node 24 and Windows checks remain available before
release, and historical publication integrity remains checked without rebuilding
the frozen 326-page 1.x book. Historical tests and published artifacts are not
deleted or rewritten.

The pre-release workflow must be dispatched before tagging a new edition. It is
also triggered by PRs that change its tooling, figures, fonts or PDF assets. This
explicit release step replaces running those expensive checks for every language
edit. Only `Language checks / check` is suitable as an always-present required PR
check; the publication workflow intentionally uses path filters.

## Privacy and dependency evidence

- Gitleaks 8.30.1 scanned all local Git refs/history: 45 commit diffs, about
  11.27 MB, no detected credentials. Its redacted scan of extracted publication
  sources and recent public CI/deploy logs also found none, about 23.63 MB.
- All nine committed PDFs were inspected, including 2,550 embedded source
  attachments and PDF metadata. The targeted text scan found no personal local
  paths or private-key headers. The committed text/source scan covered 2,606 text
  files and attachments; binary/font data was not treated as text.
- Metadata inspection of 172 committed PNG/JPEG files found no GPS, camera-owner,
  serial-number, artist or user-comment EXIF fields. Images were not OCR-scanned
  for arbitrary sensitive content. Commit author/committer addresses use GitHub
  noreply addresses.
- Both npm lockfiles had zero advisory matches. The maintained Python validation
  requirements also had zero matches after the three affected packages changed.
  Original publication pins still record vulnerable versions for provenance; use
  only isolated, trusted historical reconstruction if those versions are needed.
- GitHub secret scanning and push protection are enabled, with zero reported
  secret-scanning alerts. Repository and Pages environment secret counts are zero.
- Builds use hosted runners and read-only tokens, with no `pull_request_target`,
  privileged `workflow_run`, or untrusted event text embedded in shell commands.
  Pages remains manual and its environment permits only the `main` branch.

Tools were downloaded from their official releases and verified against the
published SHA-256 digests. Redacted scanner output and temporary extracted sources
stay under ignored `tmp/ci-audit/`; they are not uploaded as public artifacts.

## Repository settings still requiring an owner decision

These are configuration recommendations, not changes made by the workflow PR:

- `main` has no branch protection. Require PRs and the single routine `check`
  before merging; otherwise workflows cannot enforce themselves against direct
  pushes or unchecked merges.
- Dependabot alerts and automatic security updates are disabled. Enable them for
  ongoing dependency visibility; this audit is a point-in-time result. The current
  CLI credential does not have the additional administrative scope requested by
  the dependency-alert API; it was not expanded during this audit.
- Repository Actions policy allows all actions without mandatory SHA pinning,
  and fork approval applies only to first-time contributors. Consider enforcing
  immutable action pins and approval for all outside contributors. The committed
  workflows are pinned regardless of that optional repository-wide enforcement.

## Validation

Local validation passed `npm run check` (202 tests and all configured gates), the
three publication-boundary regressions, the production build with lifecycle
scripts disabled, and artifact validation. Actionlint 1.7.12 found no workflow
errors. The updated Python environment passes exact figure/notation checks, the
116-page 2.0 PDF check, the 326-page historical PDF integrity check and all seven
archive tests. No language semantics, release artifacts or production design were
changed. GitHub run results are recorded on the implementation PR.
