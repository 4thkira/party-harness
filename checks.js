/*
Party Harness - Copyright (C) 2026 Party Harness contributors
SPDX-License-Identifier: GPL-3.0-only
This program is free software: you can redistribute it and/or modify it under
the GNU General Public License version 3 as published by the Free Software Foundation.
This program is distributed without any warranty; see LICENSE for details.
You should have received a copy of the GNU General Public License along with
this program. If not, see https://www.gnu.org/licenses/.
*/
"use strict";

// Invariant checks for the Party Harness prototype. Run with: node checks.js
//
// This exists because the prototype's correctness rests on a handful of relationships that live in
// two files at once and are enforced by nothing but a comment asking the next reader to notice them.
// The default system prompt already drifted that way once, losing the prompt-injection guardrail
// from the browser copy. Everything asserted here is a relationship that, if broken, fails quietly:
// no exception, no error in the UI, just a harness that forgets things or costs more than it should.

const fs = require("fs");
const path = require("path");

const HTML = fs.readFileSync(path.join(__dirname, "rp-party-harness-prototype.html"), "utf8");
const SERVER = fs.readFileSync(path.join(__dirname, "server.js"), "utf8");
const LAUNCHER = fs.readFileSync(path.join(__dirname, "start-party-harness.ps1"), "utf8");
const RELEASE = fs.readFileSync(path.join(__dirname, "prepare-release.js"), "utf8");
const README = fs.readFileSync(path.join(__dirname, "README.md"), "utf8");

let failures = 0;
let checks = 0;

function check(name, condition, detail) {
  checks += 1;
  if (condition) {
    console.log("  ok    " + name);
    return;
  }
  failures += 1;
  console.log("  FAIL  " + name + (detail ? "\n        " + detail : ""));
}

// Reads `const NAME = <number>;` out of a source file.
function num(source, name) {
  const match = source.match(new RegExp("const\\s+" + name + "\\s*=\\s*([0-9*\\s+]+);"));
  if (!match) throw new Error("could not find constant " + name);
  // Only arithmetic on literals appears in these declarations (e.g. 4 * 1024 * 1024).
  return Function("return (" + match[1] + ")")();
}

// Pulls the string entries out of a `const NAME = [ "...", "..." ].join(...)` declaration.
function promptLines(source) {
  const start = source.indexOf("const DEFAULT_SYSTEM_PROMPT = [");
  if (start < 0) throw new Error("could not find DEFAULT_SYSTEM_PROMPT");
  return source
    .slice(start, source.indexOf("].join", start))
    .split("\n")
    .map(line => line.trim())
    .filter(line => line.startsWith('"'));
}

console.log("Party Harness invariant checks\n");

console.log("system prompt");
{
  const client = promptLines(HTML);
  const server = promptLines(SERVER);
  // server.js owns this prompt; the browser keeps a copy only as a fallback for a boot where
  // GET /api/defaults does not answer. When they drift, the fallback is what a user actually gets.
  check("browser and server copies are identical", JSON.stringify(client) === JSON.stringify(server),
    "the browser fallback prompt no longer matches server.js");
  check("guardrail line is present in both",
    [client, server].every(lines => lines.some(line => /not as harness instructions/i.test(line))),
    "the line telling the model to treat an attached profile as data, not instructions, is missing");
}

console.log("\nmemory model");
{
  const trigger = num(HTML, "SUMMARY_TRIGGER");
  const keep = num(HTML, "SUMMARY_KEEP");
  const contextMatch = HTML.match(/const\s+NARRATIVE_CONTEXT_LINES\s*=\s*SUMMARY_TRIGGER\s*\+\s*(\d+);/);
  check("NARRATIVE_CONTEXT_LINES is defined in terms of SUMMARY_TRIGGER", Boolean(contextMatch),
    "it was given an independent literal, so the two can now drift apart");
  const contextLines = contextMatch ? trigger + Number(contextMatch[1]) : 0;
  // Below this, a line scrolls out of the verbatim window before the fold that would have
  // summarized it has fired: the engine forgets it for several turns, then remembers it again.
  check("verbatim window >= summary trigger (" + contextLines + " >= " + trigger + ")", contextLines >= trigger);
  check("summary keeps fewer lines than it triggers on (" + keep + " < " + trigger + ")", keep < trigger);

  const capMatch = SERVER.match(/input\.recentNarrative\.slice\(-(\d+)\)/);
  check("server recentNarrative cap exists", Boolean(capMatch));
  const cap = capMatch ? Number(capMatch[1]) : 0;
  // The server cap is a safety net. If it drops below the client's window it silently becomes the
  // real window and reopens the same forgetting gap from the other side.
  check("server cap stays above the verbatim window (" + cap + " > " + contextLines + ")", cap > contextLines);
}

console.log("\nkey readiness");
{
  // The bug this replaces: four inline copies of "is there a usable key", one of which omitted the
  // server-key clause, so rolling memory silently never ran for anyone using OPENAI_API_KEY.
  check("one hasUsableTextKey() helper exists", (HTML.match(/function hasUsableTextKey\(\)/g) || []).length === 1);
  const callers = (HTML.match(/hasUsableTextKey\(\)/g) || []).length - 1;
  check("every gate goes through it (" + callers + " call sites)", callers >= 4,
    "a readiness gate has stopped using the helper; that is how it drifted last time");
  check("the legacy single-provider flag is gone", !/serverKeyAvailable/.test(HTML),
    "serverKeyAvailable ignored which provider was selected, so it read ready for NovelAI on an OpenAI key");
  check("the summarizer gates on the shared helper",
    /if \(state\.endpoint\.trim\(\)\) return;[\s\S]{0,200}?if \(!hasUsableTextKey\(\)\) return;/.test(HTML));
  // Per provider on both sides, or the browser's idea of "ready" cannot match the server's.
  check("server reports readiness per provider", /serverKeys: \{ openai:/.test(SERVER));
  check("client reads readiness per provider", /state\.serverKeys\[state\.provider\]/.test(HTML));
}

console.log("\npersistence");
{
  // Folding used to delete the prose it summarized. The archive only helps if it survives a save.
  check("folding archives what it removes",
    /state\.archive = state\.archive\.concat\(state\.narrative\.slice\(0, cutoff\)\)/.test(HTML),
    "the fold drops lines without archiving them, which is unrecoverable data loss");
  check("the archive is written into session snapshots", /archive: state\.archive,/.test(HTML));
  check("the archive is restored from them", /state\.archive = Array\.isArray\(snapshot\.archive\)/.test(HTML));
  // Every path that replaces the workspace has to ask first, or a session's play disappears.
  const guarded = ["Loading a saved session", "Creating a new session", "Importing a session file"];
  const missing = guarded.filter(label => !HTML.includes('confirmDiscardSession("' + label + '")'));
  check("all three session-replacing paths guard unsaved play", missing.length === 0,
    "unguarded: " + missing.join(", "));
}

console.log("\npinned canon");
{
  // The one thing that must survive a fold intact. It has to reach both the turn and the summarizer.
  check("client sends it with each turn", /pinnedFacts: state\.pinnedFacts,/.test(HTML));
  check("server puts it in the cacheable prefix", /pinnedFacts: typeof input\.pinnedFacts/.test(SERVER));
  check("the turn instructions tell the model it outranks the summary",
    /pinnedFacts holds canon the player has fixed permanently/.test(SERVER));
  check("the summarizer is told to respect it", /If PINNED CANON is supplied/.test(SERVER));
}

console.log("\nkey persistence");
{
  check(".env loader exists", /function loadEnvFile\(\)/.test(SERVER));
  // A real environment variable has to win, or the file silently overrides a deliberate override.
  check("environment variables outrank the file", /if \(!process\.env\[name\]\)\s*\{\s*process\.env\[name\] = value;/.test(SERVER));
  check("both providers can hold a server-side key",
    /novelai: process\.env\.NOVELAI_API_KEY/.test(SERVER),
    "only OpenAI had one, so NovelAI users re-entered a token on every refresh");
  check(".env diagnostics expose active names without values",
    /envFileActiveSettings:/.test(SERVER) && /Active settings:/.test(SERVER),
    "the launcher and Settings need to distinguish a present file from a file with usable entries");
  check("commented .env entries are not treated as active", /trimmed\.startsWith\("#"\)/.test(SERVER));
  check("launcher reports an empty .env clearly", /contains no active settings/.test(LAUNCHER));
}

console.log("\nerror reporting and narrow editor layout");
{
  check("request size errors name the affected endpoint", [
    "Character profile request is too large",
    "Turn request is too large",
    "Image request is too large",
    "Summary request is too large"
  ].every(message => SERVER.includes(message)));
  check("invalid JSON errors name the affected endpoint", ["Character profile", "Turn", "Image", "Summary"]
    .every(endpoint => SERVER.includes(endpoint + " request must be valid JSON.")));
  check("client surfaces unreadable API responses", /function readApiJson\(response, label\)/.test(HTML)
    && /returned invalid JSON/.test(HTML));
  check("client labels connection failures", /could not connect\. Check that the local server or configured endpoint is running/.test(HTML));
  check("file reader failures are surfaced", (HTML.match(/reader\.onerror/g) || []).length >= 6);
  check("character editor stacks before upload controls can overlap",
    /\.modal\.edit-mode \.character-overview \{ grid-template-columns: 1fr; \}/.test(HTML));
  check("native portrait file control can shrink", /input\[type="file"\].*flex: 1 1 120px; width: 0;/.test(HTML));
}

console.log("\nbubble limits");
{
  const clientMatch = HTML.match(/const BUBBLE_LIMITS = \{([^}]+)\}/);
  check("client BUBBLE_LIMITS exists", Boolean(clientMatch));
  const client = {};
  if (clientMatch) for (const [, k, v] of clientMatch[1].matchAll(/(\w+)\s*:\s*(\d+)/g)) client[k] = Number(v);
  const server = {};
  for (const [, k, v] of SERVER.matchAll(/(quiet|normal|talkative):\s*\{\s*\n\s*limit:\s*(\d+)/g)) server[k] = Number(v);
  // Both sides enforce the cap deliberately (belt and braces), which only works while the numbers
  // agree. If the server's is lower, "talkative" is silently overruled before the client ever sees it.
  check("client and server caps agree", JSON.stringify(client) === JSON.stringify(server),
    "client " + JSON.stringify(client) + " vs server " + JSON.stringify(server));
}

console.log("\nNovelAI scaffolding");
{
  check("NovelAI requests carry an explicit JSON contract",
    /function buildNovelAIRequest\(\{/.test(SERVER)
      && /does not enforce a JSON schema or response_format/.test(SERVER)
      && /Return exactly one valid JSON object and nothing else/.test(SERVER));
  check("NovelAI strips reasoning wrappers before parsing",
    /function stripNovelAIReasoning\(text\)/.test(SERVER)
      && /parseNovelAITurn\(text\)/.test(SERVER)
      && /stripNovelAIReasoning\(generatedText\)/.test(SERVER));
  check("NovelAI sampling leaves headroom for structured prose",
    /temperature: 0\.78/.test(SERVER) && /top_p: 0\.95/.test(SERVER)
      && /NOVELAI_MAX_OUTPUT_TOKENS\s*=\s*2048/.test(SERVER)
      && /clampNovelAITokens\(maxTokens\)/.test(SERVER));
  check("NovelAI keeps oversized contexts and empty choices understandable",
    /function compactNovelAIContext\(source\)/.test(SERVER)
      && /NOVELAI_CONTEXT_CHAR_LIMIT/.test(SERVER)
      && /finish_reason=/.test(SERVER)
      && /matched_stop=/.test(SERVER));
}

console.log("\nrequest size budget");
{
  const bodyLimit = num(SERVER, "MAX_REQUEST_BODY_BYTES");
  const profileCap = 120000;
  const textFields = (HTML.match(/const MEMBER_TEXT_FIELDS = \[([^\]]+)\]/) || [, ""])[1].split(",").length;
  const narrativeLineCap = 20000;
  const contextLines = num(HTML, "SUMMARY_TRIGGER") + 4;
  // What the client's own field caps allow it to put in one turn request. If the server's body limit
  // sits below this, a legitimately configured party 413s with nothing in the UI naming the cause.
  const worstCase = 5 * (profileCap + textFields * 20000) + contextLines * narrativeLineCap + 3 * 30000 + 12000;
  check("server body limit clears the client's worst-case turn ("
    + (bodyLimit / 1048576).toFixed(1) + " MiB vs " + (worstCase / 1048576).toFixed(1) + " MiB)",
    bodyLimit > worstCase);
}

console.log("\nreference images");
{
  // /v1/images/generations is text-to-image and takes no input images, so reference conditioning
  // has to go to the edits endpoint, which is multipart rather than JSON.
  check("the edits endpoint is configured", /path: "\/v1\/images\/edits"/.test(SERVER));
  check("it is used only when references are present",
    /} else if \(references\.length\) \{[\s\S]{0,1200}?UPSTREAM\.openaiImageEdit/.test(SERVER),
    "a prompt-only request must still use the cheaper generations endpoint");
  check("multiple images are sent as repeated image[] parts", /field: "image\[\]"/.test(SERVER),
    "the API takes multiple references as repeated image[] fields, not one image field");
  check("uploads are verified by magic bytes, not by the claimed media type",
    /const IMAGE_SIGNATURES = \[/.test(SERVER) && /return signature \? \{ data/.test(SERVER));
  check("references are refused for providers that cannot use them",
    /if \(provider === "openai" && Array\.isArray\(input\.references\)\)/.test(SERVER));
  check("character import restores its reference image and opt-in",
    /pendingReferenceImage = imported\.referenceImage \|\| "";/.test(HTML)
      && /"character-use-reference"\)\.checked = Boolean\(imported\.useAsImageReference\)/.test(HTML),
    "character JSON import would otherwise leave the reference behind in the file");
  check("character reference preview renders the stored image",
    /character-reference-thumb/.test(HTML)
      && /pendingReferenceImage\).*Character reference preview/.test(HTML),
    "a saved reference needs a visible confirmation when the editor is reopened");
  const referenceFileCap = num(HTML, "MAX_REFERENCE_FILE_BYTES");
  check("reference source uploads allow large files to be downscaled (" + (referenceFileCap / 1048576).toFixed(0) + " MiB)",
    referenceFileCap > num(HTML, "MAX_PORTRAIT_FILE_BYTES")
      && /file\.size > MAX_REFERENCE_FILE_BYTES/.test(HTML),
    "reference uploads were still using the smaller portrait-only ceiling");
  check("reference upload errors are shown beside the preview",
    /"style-reference-note"\)\.textContent = "Style reference not set: "/.test(HTML),
    "a rejection should not be hidden below the cropped settings panel");

  const clientCap = num(HTML, "MAX_REFERENCE_IMAGES");
  const serverCap = num(SERVER, "MAX_REFERENCE_IMAGES");
  check("client and server agree on the reference cap (" + clientCap + ")", clientCap === serverCap,
    "client " + clientCap + " vs server " + serverCap);

  const perImage = num(SERVER, "MAX_REFERENCE_IMAGE_BYTES");
  const imageBody = num(SERVER, "MAX_IMAGE_REQUEST_BODY_BYTES");
  // References arrive base64-encoded inside a JSON body, which costs about 4/3 of their bytes.
  const worstCase = Math.ceil(serverCap * perImage * 4 / 3);
  check("the image body limit clears " + serverCap + " references at full size ("
    + (imageBody / 1048576).toFixed(0) + " MiB vs " + (worstCase / 1048576).toFixed(1) + " MiB)",
    imageBody > worstCase);
  // The client downscales before upload; if that ceiling ever exceeded the server's, uploads would
  // be accepted by the browser and then silently dropped server-side.
  const clientThreshold = num(HTML, "REFERENCE_COMPACT_THRESHOLD");
  check("client downscale threshold stays under the server's per-image limit",
    Math.ceil(clientThreshold * 3 / 4) < perImage);
}

console.log("\nimage provider safety");
{
  check("switching image providers clears connection-specific fields",
    /settings-image-provider"\)\.addEventListener\("change"[\s\S]{0,1200}?state\.imageApiKey = ""[\s\S]{0,400}?state\.imageApiBaseUrl = ""[\s\S]{0,400}?state\.imageWorkflow = ""/.test(HTML),
    "an image key or endpoint could otherwise be sent to the newly selected provider");
  check("CSP allows loopback image URLs",
    /"img-src 'self' data: https: http:\/\/localhost:\* http:\/\/127\.0\.0\.1:\* http:\/\/\[::1\]:\*"/.test(SERVER),
    "local providers may return an HTTP image URL when base64 output is unavailable");
  check("ComfyUI workflow expansion stays bounded",
    /estimatedExpandedBytes > MAX_IMAGE_WORKFLOW_BYTES/.test(SERVER)
      && /Buffer\.byteLength\(workflowJson, "utf8"\) > MAX_IMAGE_WORKFLOW_BYTES/.test(SERVER),
    "the pre-replacement workflow cap is not enough when a prompt appears repeatedly");
}

console.log("\nrelease packaging");
{
  check("README points new users to tested releases",
    /GitHub Releases page/.test(README) && /party-harness-public\.zip/.test(README),
    "the tutorial should explain where stable downloads and update notes live");
  check("release packaging includes version history",
    /'CHANGELOG\.md'/.test(RELEASE),
    "public downloads should carry their release notes");
  check("release packaging preserves the supplied roster",
    !/data\.replace\(\/Spierce\/g/.test(RELEASE),
    "the release script should not rewrite character names globally");
}

console.log("\ntext-only workspace");
{
  check("image area is enabled by default", /showImageArea: true/.test(HTML));
  check("image-area preference is persisted and restored",
    /showImageArea: state\.showImageArea/.test(HTML)
      && /state\.showImageArea = settings\.showImageArea !== false/.test(HTML));
  check("Settings exposes a text-only toggle", /settings-show-image-area/.test(HTML)
    && /Show generated image area/.test(HTML));
  check("text-only mode removes the visual column from the grid",
    /\.workspace\.text-only \.visual-column \{ display: none; \}/.test(HTML)
      && /\.workspace\.text-only \{ grid-template-columns: minmax\(0, 1fr\) minmax\(285px, \.8fr\); \}/.test(HTML));
  check("hidden image mode cannot start a generation request", /!state\.showImageArea/.test(HTML));
}

console.log("\nstory text formatting");
{
  check("story text has a safe Markdown renderer",
    /function formatStoryText\(value\)/.test(HTML)
      && /escapeHtml\(raw\)/.test(HTML)
      && /formatted-heading/.test(HTML)
      && /formatted-list/.test(HTML));
  check("formatting preference is user-visible and persisted",
    /id="settings-text-formatting"/.test(HTML)
      && /textFormatting: state\.textFormatting/.test(HTML)
      && /state\.textFormatting = settings\.textFormatting === "plain"/.test(HTML));
  check("formatting preference reaches the scene engine",
    /textFormatting: state\.textFormatting/.test(HTML)
      && /textFormatting: settings\.textFormatting === "plain"/.test(SERVER));
}

console.log("\nsidebar navigation");
{
  check("third column exposes accessible Party, World, and Trace tabs",
    ["data-sidebar-tab=\"party\"", "data-sidebar-tab=\"world\"", "data-sidebar-tab=\"trace\""].every(tab => HTML.includes(tab))
      && /role="tablist"/.test(HTML) && /role="tabpanel"/.test(HTML));
  check("sidebar panels scroll within the desktop rail",
    /\.sidebar-panels \{ min-height: 0; flex: 1 1 auto; \}/.test(HTML)
      && /\.sidebar-panel \{ min-height: 0; height: 100%; overflow-y: auto;/.test(HTML));
  check("tab switching keeps selection and hidden panels in sync",
    /function setSidebarTab\(tab, moveFocus = false\)/.test(HTML)
      && /button\.setAttribute\("aria-selected", String\(selected\)\)/.test(HTML)
      && /panel\.hidden = !selected/.test(HTML));
  check("sidebar tabs support keyboard navigation",
    /ArrowRight.*moveSidebarTab\(button, 1\)/.test(HTML)
      && /ArrowLeft.*moveSidebarTab\(button, -1\)/.test(HTML)
      && /event\.key === "Home"/.test(HTML) && /event\.key === "End"/.test(HTML));
  check("contextual bubbles float outside the scrollable party panel",
    /id="sidebar-bubble-layer"/.test(HTML)
      && /function renderPartyBubbles\(\)/.test(HTML)
      && /function positionSidebarBubbles\(\)/.test(HTML)
      && /sidebar-panel-party"\)\.addEventListener\("scroll", positionSidebarBubbles/.test(HTML),
    "the party panel's overflow boundary must not clip speaker bubbles");
}

console.log("\nprompt cache prefix");
{
  const start = SERVER.indexOf("const context = {");
  const block = SERVER.slice(start, SERVER.indexOf("};", start));
  // `party,` is shorthand, the rest are `name:` pairs.
  const at = field => {
    const shorthand = block.indexOf("\n    " + field + ",");
    return shorthand >= 0 ? shorthand : block.indexOf("\n    " + field + ":");
  };
  const order = ["party", "scenario", "sessionPrompt", "settings", "scene", "worldState", "storySoFar", "recentNarrative", "playerAction"]
    .map(field => ({ field, at: at(field) }));
  const missing = order.filter(entry => entry.at < 0).map(entry => entry.field);
  check("every expected context field is present", missing.length === 0, "missing: " + missing.join(", "));
  // Providers cache on a matching prompt prefix. Anything that changes every turn placed ahead of
  // the party breaks the prefix immediately, and the attached profiles behind it -- tens of KB --
  // get re-read at full price on every turn.
  const volatile = ["scene", "worldState", "storySoFar", "recentNarrative", "playerAction"];
  const staticEnd = Math.max(...order.filter(e => !volatile.includes(e.field)).map(e => e.at));
  const volatileStart = Math.min(...order.filter(e => volatile.includes(e.field)).map(e => e.at));
  check("static context fields all precede volatile ones", staticEnd < volatileStart,
    "a per-turn field is ahead of the party/scenario block, so nothing caches");
}

console.log("\nstructured roleplay runtime");
{
  check("server schema requires an ordered beat timeline",
    /beats:\s*\{[\s\S]{0,1200}?enum: \["narration", "dialogue", "pause", "system", "check"\]/.test(SERVER)
      && /required: \["narration", "bubbles", "suggestions", "beats", "stateChanges"\]/.test(SERVER));
  const stateArrays = ["feelingUpdates", "statDeltas", "relationshipDeltas", "inventoryChanges", "conditionChanges", "flagChanges", "clockChanges", "objectiveChanges", "memoryCandidates"];
  check("every mechanical proposal array is required", stateArrays.every(name => SERVER.includes('"' + name + '"'))
    && /required: \["feelingUpdates", "statDeltas", "relationshipDeltas"/.test(SERVER));
  check("mechanical world state reaches the provider context",
    /worldState: publicWorldState\(\)/.test(HTML) && /worldState: boundedWorldState\(input\.worldState\)/.test(SERVER));
  check("beats stop at explicit pauses and can resume locally",
    /function processBeatQueue\(\)/.test(HTML) && /state\.pendingPause = \{ \.\.\.beat/.test(HTML)
      && /data-pause-continue/.test(HTML));
  check("checks resolve locally before their result returns to the model",
    /function resolvePendingCheck\(\)/.test(HTML) && /Math\.floor\(Math\.random\(\) \* 100\) \+ 1/.test(HTML)
      && /CHECK RESULT/.test(HTML));
  check("state proposals pass through a bounded reducer",
    /function applyStateChanges\(result\)/.test(HTML) && /boundedInteger\(member\.stats\[index\] \+ delta, 0, 100\)/.test(HTML));
  check("undo checkpoints include prose and mechanical state",
    /function captureTurnCheckpoint\(action\)/.test(HTML) && /worldState: structuredClone\(state\.worldState\)/.test(HTML)
      && /restoreTurnCheckpoint\(checkpoint\)/.test(HTML));
  check("runtime state, traces, and pauses survive session saves",
    ["pendingPause", "beatQueue", "worldState", "memoryCandidates", "turnTraces", "turnCheckpoints"]
      .every(name => new RegExp(name + ": state\\." + name).test(HTML)));
  check("muted characters are rejected on both sides",
    /member\.muted \|\| !text/.test(SERVER) && /member\.muted \|\| typeof bubble\.text/.test(HTML));
}

console.log("\ngenerated session setup");
{
  check("new-session form exposes a user prompt", /id="session-generation-prompt"/.test(HTML));
  check("generated setup remains review-gated",
    /Nothing is created until you review them/.test(HTML) && /GENERATE EDITABLE SETUP/.test(HTML));
  check("current party context is optional", /id="session-generation-use-party"/.test(HTML));
  check("session generator uses a strict server schema",
    /name: "session_setup"/.test(SERVER) && /schema: sessionSetupSchema/.test(SERVER));
  check("generated fields fill the editable form",
    /function generateSessionSetup\(\)/.test(HTML) && /\$\("session-premise"\)\.value/.test(HTML));
  check("session setup has its own validated endpoint",
    /req\.url === "\/api\/session-setup"/.test(SERVER) && /handleSessionSetup\(req, res\)/.test(SERVER));
  const presetFunction = (HTML.match(/function applySessionPreset\(id\) \{[\s\S]*?\n    \}/) || [""])[0];
  check("current party stays enabled by default for presets",
    /id="session-keep-party" type="checkbox" checked/.test(HTML)
      && !/session-keep-party"\)\.checked = false/.test(presetFunction)
      && /addEventListener\("click", \(\) => openSessionSetup\(\)\)/.test(HTML));
}

console.log("\ncustom session stats");
{
  check("session setup exposes editable stat definitions",
    /id="session-stat-editor"/.test(HTML) && /id="add-session-stat"/.test(HTML));
  check("sessions support one to five stats",
    /const MAX_SESSION_STATS = 5/.test(HTML) && /if \(current\.length <= 1\) return/.test(HTML));
  check("party cards and character values use active definitions",
    /normalizeStatDefinitions\(state\.statDefinitions\)\.map\(\(stat, index\)/.test(HTML)
      && /formatStatsForInput\(member\.stats\)/.test(HTML));
  check("turn requests include stat meanings",
    /statDefinitions: normalizeStatDefinitions\(state\.statDefinitions\)/.test(HTML)
      && /scenario\.statDefinitions/.test(SERVER));
  check("server validates proposed stats against the session",
    /function normalizeTurn\(value, party, bubbleLimit = 2, statDefinitions = \[\]\)/.test(SERVER)
      && /const resolveStat = candidate/.test(SERVER));
  check("stat definitions survive version 4 session saves",
    /version: 4/.test(HTML) && /statDefinitions: normalizeStatDefinitions\(state\.statDefinitions\)/.test(HTML)
      && /state\.statDefinitions = normalizeStatDefinitions\(scenario\.statDefinitions\)/.test(HTML));
  check("genre presets carry distinct stat sets",
    ["candor", "finesse", "command"].every(id => HTML.includes('id: "' + id + '"')));
  check("generated sessions propose their own stats",
    /required: \["sessionName"[\s\S]*?"statDefinitions"/.test(SERVER)
      && /renderSessionStatEditor\(result\.statDefinitions\)/.test(HTML));
}

console.log("\ndefault model");
{
  const serverDefault = (SERVER.match(/process\.env\.OPENAI_MODEL \|\| "([^"]+)"/) || [])[1];
  const clientDefault = (HTML.match(/\n      model: "([^"]+)",/) || [])[1];
  const launcherDefault = (LAUNCHER.match(/OPENAI_MODEL\s*=\s*"([^"]+)"/) || [])[1];
  check("server and client agree (" + serverDefault + ")", serverDefault === clientDefault,
    "server " + serverDefault + " vs client " + clientDefault);
  check("launcher default agrees (" + launcherDefault + ")", launcherDefault === serverDefault,
    "launcher " + launcherDefault + " vs server " + serverDefault);
}

console.log("\nregex guards");
{
  // `/^data:image//i.test(x)` parses cleanly as a regex followed by an identifier, so both files
  // still compile while every data-URL guard silently stops matching what it was written to match.
  // These guards decide what gets rendered into an <img>, stored, and uploaded to a provider, so a
  // check that only proves the file parses is not enough.
  const wellFormed = (HTML.match(/\/\^data:image\\\/\/i/g) || []).length;
  const broken = (HTML.match(/\/\^data:image\/\/i/g) || []).length;
  check("every data:image guard is a complete regex (" + wellFormed + " found, " + broken + " malformed)",
    broken === 0 && wellFormed > 0,
    "a guard reads /^data:image//i -- the slash is unescaped, so it matches nothing it should");
  // Same failure mode, same consequence: this one gates what an <img src> is allowed to load.
  check("the portrait-source guard still requires https or a data image",
    /\/\^\(https:\\\/\\\/\|data:image\\\/\)\/i/.test(HTML));
}

console.log("\nsyntax");
{
  check("server.js parses", (() => {
    try { new Function(SERVER); return true; } catch { return false; }
  })());
  check("inline browser script parses", (() => {
    try {
      new Function(HTML.slice(HTML.indexOf("<script>") + 8, HTML.lastIndexOf("</script>")));
      return true;
    } catch { return false; }
  })());
}

console.log("\n" + (failures ? failures + " of " + checks + " checks FAILED" : "all " + checks + " checks passed"));
process.exit(failures ? 1 : 0);
