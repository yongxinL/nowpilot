# NowPilot Deployment and Release Guide

## 1. Deployment targets

- Developer deployment: unpacked Chrome extension.
- Acceptance deployment: clean Chrome profile with unpacked release build.
- Release deployment: versioned ZIP generated from a clean tagged commit.

## 2. Required environment

Use the Node.js and package-manager versions locked by the repository. The release workflow must fail if the running versions differ from the lock files or documented engine constraints.

Pre-flight:

```bash
node --version
pnpm --version
git status --short
git rev-parse HEAD
pnpm install --frozen-lockfile
```

Do not release from a dirty working tree.

## 3. Verification before packaging

```bash
pnpm run verify:all
pnpm run test:isolation
pnpm run test:perf
pnpm run build
```

Record command output under:

```text
.planning/evidence/release-<version>/
```

Inspect the generated manifest and bundles. Confirm:

- Manifest V3 is used;
- only approved permissions are present;
- the Side Panel path is correct;
- `standalone.html` exists;
- no source maps intended only for development are included;
- the content-script bundle contains no React, Ant Design, Defuddle, YAML, Turndown, MathML-to-LaTeX, Temml, or filesystem API code;
- no API key, token, local path, fixture secret, or raw test data is present.

## 4. Unpacked deployment

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Select **Load unpacked**.
4. Choose the generated Chrome build directory.
5. Pin NowPilot to the toolbar.
6. Open both the Side Panel and Standalone view.

## 5. Smoke-test checklist

### Runtime

- Fresh installation opens onboarding.
- Side Panel opens from the action button.
- Side Panel contains Chat only.
- Switch to Full Chat opens one Standalone tab and reuses it on the next click.
- Workspace and conversation handoff are preserved.
- Service-worker restart does not corrupt workspace state.

### Providers

- Provider configuration validates.
- Stored API key is not displayed in plaintext after reload.
- Streaming can be aborted.
- Pre-first-token retry follows the approved limit.
- No provider switch occurs after the first token.

### Context and security

- Generic page extraction works.
- ServiceNow extraction uses the approved strategy when configured.
- Password values are absent from extracted context.
- Retrieved page text cannot override system or tool policy.
- Diagnostic export contains no raw sensitive body.

### Notes and filesystem

- Note create, edit, rename, wikilink, backlink, and search work.
- Save to Note requires user review.
- Backup remains optional and does not block note saving.
- Restore preview is additive.
- A filesystem round-trip preserves note UUIDs and links.

### Failure behaviour

- Missing provider shows a settings action.
- Blocked IndexedDB degrades safely.
- Revoked backup permission leaves IndexedDB data intact.
- Failed side-effect verification cannot be rendered as success.

## 6. Package and release

Use the repository's WXT packaging command. If no script exists, add one through an approved plan before release. Do not improvise the release command.

The release directory must contain:

```text
nowpilot-<version>-chrome.zip
SHA256SUMS
RELEASE_NOTES.md
verification.txt
manual-checks.md
```

Generate and verify the checksum:

```bash
sha256sum nowpilot-<version>-chrome.zip > SHA256SUMS
sha256sum -c SHA256SUMS
```

Tag only the verified commit:

```bash
git tag -s v<version> -m "NowPilot v<version>"
git show v<version> --stat
```

## 7. Rollback

Keep the previous verified ZIP and tag. Rollback consists of:

1. disabling the faulty extension build;
2. reinstalling the previous verified build;
3. importing or restoring only through supported compatibility paths;
4. recording the incident, affected version, reason, and recovery evidence;
5. creating a corrective branch from the failed release tag.

Never downgrade persisted data unless a tested reverse migration exists. If it does not, restore a compatible backup into a clean profile.

## 8. Release gate

Release is blocked if any of the following applies:

- verification command fails;
- a critical or high review finding remains;
- permission or bundle isolation differs from the approved design;
- secrets or raw customer data appear in artefacts or diagnostics;
- migration or restore testing fails;
- rollback artefact is unavailable;
- manual smoke-test evidence is incomplete.
