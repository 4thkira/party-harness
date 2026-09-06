# Changelog

Versioned public releases are listed here. Entries describe user-visible changes; routine commits may be grouped into the next release.

## Unreleased

- Added local looping music and ambient layers, each with its own track and volume control. Files stay in the user's `music/` and `ambience/` folders and are served only through the local harness.
- Reserved a separate middle-column row for those audio controls, so a tall scene preview cannot cover them at short or narrow viewport sizes.
- Added portrait expression sets. Multiple uploaded expressions travel with a character sheet, and the selected expression becomes that character's portrait throughout the interface.
- Added a Party Banter control for short, spontaneous character exchanges that do not advance the turn or apply mechanical state changes.
- Added an animated local roll presentation for stat checks, with reduced-motion support.
- Added user-authored CSS interface skins loaded from the local `skins/` folder.
- Added scene bookmarks and a History tab containing bookmarked excerpts and a chronological record of relationship changes. Relationship history participates in turn undo.

## [0.5.0] — 2026-09-06

- Added draggable desktop dividers between Story, Image, and Party. Column priorities persist with workspace saves and exports, support arrow-key adjustment, reset on double-click, and yield to stacked or text-only layouts.
- Made rolling summaries explicitly fallible working memory. Pinned canon, corrected world state, reviewed memories, and recent verbatim events now outrank compressed summaries; the summarizer preserves uncertainty and avoids hardening isolated reactions into lasting traits.
- Rebalanced the default desktop columns, allowed two-line scene titles, compacted scene metadata, and repaired the crowded 561–720 px header range.
- Stat checks now disclose a substituted stat instead of silently rolling the first one. When a scene asks for a stat the session does not define, the transcript, the world-state record, and the text sent back to the model all name what was requested and what was rolled instead.
- Made a check roll reproducible. The roll is fixed when the check appears rather than when you press ROLL, so undoing back to a check and rolling it again gives the same number instead of quietly rerolling.
- Stopped re-rendering the folded archive on every redraw. A long session with "Earlier scenes" expanded no longer re-formats every archived line each time a beat is revealed or a feeling changes.
- Made a custom system prompt actually take precedence. Instructions are now sent as three labelled blocks — response contract, session settings, and author direction — with the author's prompt ranked above the harness's default storytelling guidance rather than silently appended to it.
- Documented that a stat check spends a second provider request, and that a character profile you did not write is prompt text a stranger controls.
- Widened the save-file ignore rule so new session exports cannot be committed by accident, and reported the two test suites separately so a static-invariant total is not mistaken for behavioral coverage.

## [0.4.2] — 2026-09-06

- Recovered visible NovelAI output from OpenAI-style logprob token strings when the provider returned `finish_reason=stop` with an empty `text` field.
- Added regression coverage for both standard and converted NovelAI logprob shapes and documented the recovery behavior.

## [0.4.1] — 2026-09-06

- Clarified the empty bubble status so ordinary transcript dialogue is not described as a silent party.

## [0.4.0] — 2026-09-06

- Made party bubbles independent additive asides instead of duplicate transcript dialogue.
- Added explicit speech and thought bubble kinds, with a dashed thought-bubble treatment and screen-reader announcements that distinguish spoken asides from private thoughts.
- Kept legacy snapshots compatible by treating bubbles without a kind as speech bubbles, and updated provider prompts, NovelAI JSON guidance, README, and the harness summary to document the contract.

## [0.3.2] — 2026-09-06

- Applied the NovelAI output and context safeguards to character-profile and session-setup fallback requests as well as live turns.

## [0.3.1] — 2026-09-06

- Made NovelAI turns fit the provider's documented output allowance instead of requesting an oversized JSON response that could come back as HTTP 200 with an empty `text` field.
- Trimmed only the NovelAI request copy of oversized attached profiles and scene context; saved sessions and exports keep their full text.
- Expanded empty NovelAI response errors with `finish_reason`, `matched_stop`, and token-count details so provider-side stops are diagnosable.

## [0.3.0] — 2026-09-05

- Improved NovelAI text scaffolding with an explicit JSON contract, conservative sampling, reasoning-wrapper cleanup, and a playable plain-prose fallback when the model ignores the JSON shell.
- Added display-only story text formatting with safe Markdown emphasis, headings, lists, and inline code, plus a Plain text option.

## [0.2.2] — 2026-09-05

- Restored the original floating speech-bubble presentation beside the third-column party cards.
- Anchored bubbles to their cards while the Party panel scrolls, so they can extend into the main workspace without being clipped.

## [0.2.1] — 2026-09-05

- Kept contextual speech bubbles visible after the sidebar became scrollable by placing them inside their party cards instead of letting the new overflow boundary clip them.

## [0.2.0] — 2026-09-05

- Split the right-hand workspace rail into Party, World, and Trace tabs so roster tools, runtime state, and diagnostics remain easy to find.
- Added an internal desktop scroll area for long sidebar content, keyboard navigation for the tabs, and plain-language panel descriptions.

## [0.1.1] — 2026-09-05

- Updated the beginner README tutorial to distinguish tested Releases downloads from the current `main` branch and explain the version numbering.

## [0.1.0] — 2026-09-05

First public release of Party Harness.

- Local-first browser roleplay harness with editable party members, scenarios, custom stats, pauses, checks, world state, memories, undo, autosave, import/export, and tab-title generation status.
- Text connections for OpenAI, NovelAI, Anthropic, Gemini, OpenRouter, DeepSeek, Groq, Ollama, LM Studio, and custom OpenAI-compatible servers.
- Image connections for OpenAI Images, NovelAI, Stability AI, AUTOMATIC1111/Forge, Fooocus, ComfyUI API-format workflows, and custom OpenAI-compatible image servers.
- Optional page-turn sound, accessible control hints, local `.env` configuration, and beginner-focused setup documentation.
- GPL-3.0-only licensing and a clean public-release builder that excludes keys, personal profiles, saves, and audio.

[Unreleased]: https://github.com/4thkira/party-harness/compare/v0.5.0...HEAD
[0.5.0]: https://github.com/4thkira/party-harness/releases/tag/v0.5.0
[0.4.2]: https://github.com/4thkira/party-harness/releases/tag/v0.4.2
[0.4.1]: https://github.com/4thkira/party-harness/releases/tag/v0.4.1
[0.4.0]: https://github.com/4thkira/party-harness/releases/tag/v0.4.0
[0.3.2]: https://github.com/4thkira/party-harness/releases/tag/v0.3.2
[0.3.1]: https://github.com/4thkira/party-harness/releases/tag/v0.3.1
[0.3.0]: https://github.com/4thkira/party-harness/releases/tag/v0.3.0
[0.2.2]: https://github.com/4thkira/party-harness/releases/tag/v0.2.2
[0.2.1]: https://github.com/4thkira/party-harness/releases/tag/v0.2.1
[0.2.0]: https://github.com/4thkira/party-harness/releases/tag/v0.2.0
[0.1.1]: https://github.com/4thkira/party-harness/releases/tag/v0.1.1
[0.1.0]: https://github.com/4thkira/party-harness/releases/tag/v0.1.0
