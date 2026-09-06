# Working on Party Harness

Run `node server.js`, then open the printed local address. Refresh the browser after frontend changes; restart the server after backend or `.env` changes. Export any story you want to keep before experimenting with storage code.

## File map

| File | Start here for |
| --- | --- |
| `rp-party-harness-prototype.html` | Layout, CSS variables, sample party/scenarios, prompts, UI events, and client state. |
| `server.js` | Local HTTP routes, provider requests, structured response validation, and profile discovery. |
| `text-providers.js` | Hosted/local text protocol adapters, preset URLs, auth, and output modes. |
| `image-providers.js` | Image provider presets, safe local endpoint validation, and ComfyUI workflow placeholder handling. |
| `harness-storage.js` | IndexedDB, fallback storage, save migration, and pooled transcript encoding. |
| `start-party-harness.ps1` / `.cmd` | Windows startup. Other platforms can run Node directly. |
| `.env.example` | Supported configuration placeholders. Never put actual credentials here. |
| `characters/example.md` | A shareable sample profile. |

Search for `DEFAULT_PARTY`, `DEFAULT_STAT_DEFINITIONS`, and `DEFAULT_SYSTEM_PROMPT` for starting content. Most colors and spacing are in the HTML style block. Keep IDs stable when changing labels: event handlers and checks refer to them.

The browser sends roleplay requests to the local server, which calls the provider and normalizes structured replies. Changing that reply format requires matching server schema, normalization, and client handling. Image UI adapters are deliberately small: A1111/Forge and Fooocus send their documented JSON requests, while ComfyUI accepts a user-owned API-format workflow and only replaces explicit prompt placeholders. The custom backend field expects the roleplay contract; it is not an arbitrary OpenAI-compatible base URL.

Keep API keys out of persistent state, session exports, and logs. Keep the server bound to loopback. Apply consequences only when their story beat is revealed; discard unrevealed consequences when branching. Late replies must not change a different session or overwrite newer edits. Preserve backward-compatible save imports.

## Checks

```sh
node checks.js
node --test regression-checks.js provider-checks.js
```

The two suites prove different things and their totals are not comparable. `checks.js` is static: it reads the source files and asserts that a relationship between them is still written down. It catches the failure this project keeps hitting — two files that have to agree quietly drifting apart — but a rename can break a check that is still true, and broken behavior can still satisfy one. `regression-checks.js` runs the actual browser script against minimal DOM stubs and deferred provider replies, so it is the suite that establishes behavior. New behavior belongs there; add a source-invariant check only for a coupling that would otherwise fail silently.

For browser testing without provider requests, run `node browser-test-server.js` and visit `http://127.0.0.1:18977/`. This is a deterministic test fixture, not an offline story generator. Its `/storage-checks` page runs storage checks on that separate test origin. Do not change it to your everyday save origin.

Manually check Help with keyboard navigation and Escape, Settings including the Story text formatting selector, the Party / World / Trace sidebar tabs, both desktop column dividers by drag and keyboard, a long party that needs scrolling, a contextual speech bubble floating beside its party card, a new session, cancellation, a paused response, world edits, memory review, draft restoration, and save/export/import. Check that saved column proportions return, reset on double-click, and disappear in text-only and narrow layouts. When using NovelAI, also check a normal JSON response and a plain-prose response so the compatibility fallback remains readable. Fake-provider tests cannot establish real model quality, account access, image generation, or billing behavior.

## Build a public download

Run `node prepare-release.js`. It creates a fresh timestamped folder under `dist/` using an explicit file allowlist. It includes source, beginner docs, version history, tests, launchers, a placeholder configuration, and one sample profile. It excludes `.env`, personal characters/saves, review notes, and local audio. The working copy is left intact.

Upload the contents of that generated folder to your GitHub repository, or zip that folder for a release. Check that `LICENSE` is included before publishing. The builder does not publish anything. `.gitignore` helps protect a working checkout, but cannot remove files already committed to Git history; the clean folder is the intended starting point for this project.

## Versioned GitHub releases

Use semantic version tags such as `v0.1.0` for public downloads. Add the user-facing changes to `CHANGELOG.md`, run both checks above, build a fresh public folder, and zip that folder. Commit the source and changelog, then create an annotated tag and push it with the commit:

```sh
git add .
git commit -m "Prepare v0.2.0 release"
git tag -a v0.2.0 -m "Party Harness v0.2.0"
git push origin main --follow-tags
```

On GitHub, open **Releases → Draft a new release**, choose the tag, paste the matching changelog section into the notes, and attach the ZIP from `dist/`. Keep the tag, changelog heading, and download name on the same version. Patch releases (`v0.1.1`) suit fixes; minor releases (`v0.2.0`) suit new features; major releases (`v1.0.0`) suit breaking changes.

Each version is a permanent historical snapshot. Create a new tag and GitHub release rather than editing, retagging, deleting, or replacing an older one. Move the finished bullets from `Unreleased` into a dated version heading, keep an empty `Unreleased` section above it, add the version link at the bottom of the changelog, and use those same bullets as the release notes. Attach a newly built `party-harness-public.zip` to that version even though older releases use the same asset name; GitHub keeps each asset under its own tag.

Only add assets you have permission to distribute. Code licensing does not grant rights to provider services or characters, images, and audio supplied by other people.
