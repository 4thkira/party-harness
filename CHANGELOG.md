# Changelog

Versioned public releases are listed here. Entries describe user-visible changes; routine commits may be grouped into the next release.

## Unreleased

- Kept saves as files. Named saves and the autosave are also written to a `saves/` folder beside `server.js`, so clearing browser data, switching browsers, or changing the port no longer loses them: an empty browser restores the last workspace from `saves/autosave.json`, and **SESSIONS** lists saves that exist only as files. The server signs the files it writes, and a file it did not write loads with the same caution as an imported session. The files can be turned off in Settings, never contain API keys, and are ignored by Git and left out of release downloads.
- Added **SAVE KEY TO .ENV** and **FORGET SAVED KEY** beside the text and image key boxes, so keeping a key between launches no longer means creating, renaming, and editing a text file. Only a provider's key can be written, as a single token; the file's other lines, comments, and line endings are kept; and the key works at once, without a restart. A real environment variable still takes precedence, and Settings says when one does.
- Noticed a `.env.txt` beside `server.js`, the name Windows gives a `.env` made with hidden file extensions. The server window and Settings now explain why its keys are not loading, and saving a key from Settings copies its contents into a proper `.env`.
- Replaced TEST LOCAL CONNECTION with **CHECK CONNECTION + LIST MODELS**. It asks the selected provider for its model list, which proves the key and address work without generating or billing anything, and fills the Model box with the models you can use (free OpenRouter models are marked). Embedding, speech, and image models are left out. The connection dot turns green once a provider has accepted the key, and resets when the provider, address, or key changes.
- Explained unreachable providers in plain language. A stopped Ollama now reads "Nothing is answering at http://127.0.0.1:11434. Start Ollama, check the address in Settings, and try again." instead of `connect ECONNREFUSED 127.0.0.1:11434`, for turns, summaries, profiles, session setup, and images alike.
- Fixed character stats changing when a sheet was saved in a session with a digit in a stat label. **+ ADD STAT** labels a new stat S4, and the sheet read that label's digit as a value, so a fourth stat of 50 was saved as 4 — even when only the personality had been edited.
- Fixed the Midnight, Ember, and Violet palettes only partly applying. Two of their colors were written under names the stylesheet never read, and the backdrop color was never used at all, so secondary surfaces and the page background stayed neutral grey. Neutral looks exactly as it did.
- Fixed the Windows launcher replacing an `OPENAI_MODEL` set in `.env` with its own default, and ignoring an `RP_PORT` set in `.env` when it announced the port and looked for an older harness to replace.
- Treated text after a space and a `#` on a `.env` line as a comment, as most `.env` readers do. A note beside a key (`OPENAI_API_KEY=sk-... # my main key`) used to be sent to the provider as part of the key, and a placeholder such as `GROQ_API_KEY= # fill in later` counted as a configured key. A `#` inside quotes, or with no space before it, is kept.
- Stopped model-proposed objectives, clocks, conditions, items, relationships, and facts from vanishing once their list was full. They were reported as applied and then discarded; they are now refused and listed under Rejected in the Trace tab, the way a manual addition to a full list already was. Changes to existing entries still apply.
- Fixed **CANCEL TURN** during Party Banter typing "Party banter" into the action box, where the next Enter would have sent it as a turn.
- Fixed a folder character profile hiding a failed LLM pass: the sheet was left with its fields cleared under a status that still said the profile was being sent. The error is now shown, and the profile stays attached.
- Kept stat-check results out of the ↑ previous-action list, so the first ↑ after a roll recalls what you typed rather than the harness's CHECK RESULT message.
- Stopped Escape from asking to discard an untouched new character sheet.
- Made a proposed stat change for a stat with no stored value start from the 50 shown on the character's card instead of 0.
- Fixed local music and ambience answering a request for a file's last bytes with its first bytes, and an empty skin file leaving its request hanging.
- Made image requests with reference images stop blocking the server while they upload. The request size was re-measured on every chunk, which cost about two seconds for a 12 MiB request.
- Fixed a NovelAI image occasionally failing to extract when its image data happened to contain a ZIP directory signature.
- Made an unknown text provider return a clear error instead of a generic server failure, an unusable `RP_PORT` stop with a plain message instead of a stack trace (0 no longer starts an unreachable server), and malformed JSON from the model say that it came from the model.
- Added regression coverage for each of the fixes above, plus static checks that palette colors match the stylesheet and that the launcher leaves `OPENAI_MODEL` to `.env`.

## [0.6.0] — 2026-09-06

- Documented that Party Harness is not an online service and has no hosted version, account, sign-in, or telemetry, so a session stays as private as the person running it wants — including for explicit material. The same section is equally clear that the privacy boundary is the text provider: a model running on your computer keeps everything local, while a hosted provider receives your prompts and applies its own policies.
- Added a "How checks work" section to the README covering the roll-over convention, the target formula, worked examples, and why the harness owns the roll rather than the model. The convention had never been written down anywhere.
- Switched stat checks to roll-over, so a high roll always reads as a good roll. The odds are unchanged — a stat of 50 at difficulty 50 still succeeds half the time — but the threshold is now a floor the player passes rather than a ceiling they stay under.
- Stated the check threshold explicitly everywhere it appears: the transcript, the dice overlay, the runtime panel, and the result sent back to the engine all read "rolled 80, needed 60 or over" instead of an "against 60" comparison that could be read either way. The engine had been receiving that ambiguous phrasing next to the word FAILURE and could narrate the opposite of the resolved outcome.
- Told the engine the check convention and that a CHECK RESULT is already resolved by the harness and must be narrated as written rather than recomputed from the numbers. The convention was previously undocumented anywhere in the project.
- Recorded the passing threshold on each stored check, so a check keeps the wording it was resolved under. Sessions saved before this change keep their outcomes; their checks simply omit the threshold rather than restating an old one under the new convention.
- Replaced the dice reveal's shaking question mark with a die that tumbles through values and decelerates into its result, over a duration the DICE_ROLL_MS constant now actually controls. Reduced-motion still skips straight to the number.
- Fixed NovelAI returning nothing for session generation, character import, and turns. Its OpenAI-compatible chat endpoint answers a non-streamed request with an empty text field and no message object, so those requests are now streamed and reassembled instead of falling through to a raw text-completion fallback that returned unusable prose.
- Told NovelAI which fields a session setup and a character profile must contain. That endpoint enforces no JSON schema, so a generated session filled every field with a placeholder rather than the scenario that was asked for.
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

[Unreleased]: https://github.com/4thkira/party-harness/compare/v0.6.0...HEAD
[0.6.0]: https://github.com/4thkira/party-harness/releases/tag/v0.6.0
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
