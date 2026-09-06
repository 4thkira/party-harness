# Changelog

Versioned public releases are listed here. Entries describe user-visible changes; routine commits may be grouped into the next release.

## Unreleased

Add the next user-visible changes here before creating the next version tag.

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
