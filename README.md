# Party Harness

A local browser app for roleplaying with a customizable party of AI characters. Write an action, follow the scene, and let characters react in their own voices. Edit their sheets, correct the story, track relationships and inventory, and optionally generate scene art.

See [CHANGELOG.md](CHANGELOG.md) for versioned updates and release notes.

This is a working prototype. It runs on your computer, but text generation can use a hosted provider or a model running on your computer. Hosted generation needs your own API access and may cost money. Images use a separate image provider, either hosted or a compatible server on your computer. You can explore the interface and edit characters without a key.

## Download a release

For the easiest setup, use the [GitHub Releases page](https://github.com/4thkira/party-harness/releases). Open the newest non-draft release, download `party-harness-public.zip` from **Assets**, and extract it. Releases are the tested snapshots intended for users. **Code → Download ZIP** downloads the current `main` branch instead, which may contain work that has not been released yet.

Read [CHANGELOG.md](CHANGELOG.md) to see what changed between versions. Bug-fix releases increment the last number (`v0.1.1`), feature releases increment the middle number (`v0.2.0`), and breaking changes increment the first number (`v1.0.0`).

## Start here

1. Install Node.js 22 or newer. Check it by opening a terminal and running `node --version`.
2. If you did not already download a release above, use **Code → Download ZIP**, then extract it to a folder. Keep the supplied files together.
3. On Windows, double-click **Start Party Harness.cmd**. On macOS/Linux, open a terminal in the extracted folder and run `node server.js`. There is no `npm install` step.
4. Keep that terminal open and visit **http://127.0.0.1:8787/** in your browser. Open the address, not the HTML file itself.
5. Open **SETTINGS → Text generation connection**. Choose a text provider, enter its exact model ID, and enter its API key if needed (NovelAI uses a Persistent API token). For local models, see the connection table below. Leave the custom roleplay backend URL blank.
6. Open **NEW SESSION**, choose a scenario, and review your party. Write an action and use **SEND TURN**. **HELP / START HERE** explains the controls while you play.

The included model name is a configurable default, not a promise of access. Select a model your provider actually supports. **TEST LOCAL CONNECTION** checks the included server/configuration; it does not validate your account or make a full generation request.

To stop the app, press Ctrl+C in its terminal. Use the launcher again next time.

## Keep your key between launches (optional)

Keys typed in Settings disappear when you refresh. To avoid retyping them:

1. Copy `.env.example` to a file named exactly `.env`, beside `server.js`.
2. Remove the leading `#` from the setting you need and replace its placeholder, for example `OPENAI_API_KEY=your-key-here`.
3. Restart the server. Do not post this file or include it in a download you share.

`.env` is a plain text file stored on your computer. Environment variables take precedence over it. OpenAI and NovelAI image keys fall back to their matching text key; Stability and custom image servers have their own settings. Images are requested separately with **GENERATE IMAGE**.

## Playing and saving

| Control or term | What it does |
| --- | --- |
| Party-member mode | You play the first character in the roster. Reorder the party to change who that is. |
| Unseen DM | You direct the scene without being a character the party can perceive. |
| Send turn | Sends your action and story context to the text provider. Enter sends; Shift+Enter adds a newline. |
| Continue | Reveals the next part (or “beat”) of a generated response. Choices and checks can interrupt it. |
| Undo / regenerate | Undo restores the previous exchange; regenerate retries its action with a new provider request. |
| World state | Editable inventory, conditions, relationships, objectives, progress counters (“clocks”), and facts (“flags”). |
| Memory proposal | A suggested reaction, relationship memory, or character development for you to review. It does not automatically rewrite a character. |
| Pinned canon | Your explicit continuity facts. Review AI summaries and correct mistakes when needed. |
| Sessions | Named saves, session import/export, and readable story exports. |
| Story text formatting | Markdown mode safely renders emphasis, headings, lists, and inline code; Plain text keeps the original markers visible. |

The right-hand rail is split into **Party**, **World**, and **Trace** tabs so the roster, selected character tools, mechanical state, and diagnostics do not compete for the same vertical space. The active tab scrolls on desktop; on a narrow screen the rail becomes part of the normal page flow.

Autosave and named saves live in this browser on this computer. Use the same browser, address, and port to return to them. Clearing site data can erase them. **Export session JSON** for a portable backup; **Export story (Markdown)** is a readable transcript, not a restorable session.

Session exports exclude API keys and generated image data. Save generated art separately. Character sheets, uploaded portraits, and story text may be personal, so review your session files before sharing them.

Your selected provider receives the context needed for generation, including relevant character profiles and story information. Reference images are sent when used for image generation. The included server is intended for local use; GitHub hosts the source download, not a working backend. Do not deploy it as a public service without redesigning access control.

## Bring your own characters

Edit sheets directly in the party sidebar, or place Markdown (`.md`) profiles in `characters/`. Use **REFRESH FILES**, choose a profile, and optionally **PROCESS WITH LLM** to suggest sheet fields. Review those fields before saving. Processing a profile is a provider request.

`characters/example.md` shows a simple format. You can also write ordinary prose. The supplied roster is an example; replace it with your own characters when you are ready.

## Troubleshooting

| Problem | Try this |
| --- | --- |
| “node is not recognized” | Install Node.js, then reopen the terminal or launcher. |
| The page will not open | Keep the server terminal open and use the exact address it prints. Do not double-click the HTML file. |
| Port already in use | Close the previous harness terminal, or set `RP_PORT` to another port before launching. A different port has separate browser saves. |
| Key missing after refresh | Browser-entered keys are temporary. Re-enter it or use `.env` and restart. |
| Provider rejects a request | Check the selected provider, model, key, account access, and the error text. A local-ready indicator does not validate these with the provider. |
| A reply takes too long | Use Cancel; your action is restored. The provider may already have processed or billed the request. |
| Save needs attention | Export your session before closing. Check browser storage availability; the last successful save is retained. |
| My saves seem gone | Return to the same browser and exact address/port, or import your exported session JSON. |

## Modify or contribute

Start with [DEVELOPING.md](DEVELOPING.md) for the file map, tests, and release packaging. No build step or third-party runtime packages are required. Please include reproduction steps for bugs and remove keys and personal story content from logs/screenshots.

## License

Party Harness is licensed under **GNU GPL version 3 only** (SPDX: GPL-3.0-only). See [LICENSE](LICENSE) for the full terms. You may use, study, modify, fork, and redistribute it, including commercially, under those terms. Distributed modified versions must preserve the GPL's freedoms and provide the corresponding source as required by the license.

Personal shout-outs are optional and appreciated. Required license and copyright notices still need to stay. The software comes without warranty. Personal profiles, saves, and third-party assets are not part of the public code package.

## Optional sound and control hints

Settings includes a page-turn sound toggle (off by default), volume, and Preview sound. Sound plays once when a new story passage is revealed, not while generation is pending. Preferences stay in this browser and do not travel with session exports. Hover over controls such as Mute, Initiative, and Canon / improvisation, or focus them with Tab, for explanations.

Character Mute suppresses generated dialogue; it is separate from audio. The public package does not bundle personal audio: supply your own `sfx/pageturn.mp3` (up to 5 MiB), then use Preview sound. Only distribute audio you have permission to share.

The browser tab title shows text/image generation progress, readiness, failures, and cancellation. If both run together, both statuses remain visible. Returning to the tab clears finished notices while keeping ongoing requests visible.

## Text provider connections

All text connections cover story turns, summaries, character-profile processing, and scenario generation. Image generation uses the separately selected image provider.

| Choose in Settings | Connection | Optional saved key in .env |
| --- | --- | --- |
| OpenAI | Existing Responses API integration | OPENAI_API_KEY |
| NovelAI | Existing NovelAI text integration | NOVELAI_API_KEY |
| Anthropic / Claude | Native Messages API; structured results through a forced output tool (no tool execution) | ANTHROPIC_API_KEY |
| Google Gemini | Google OpenAI-compatible API | GEMINI_API_KEY |
| OpenRouter | OpenRouter chat API; use its full model ID | OPENROUTER_API_KEY |
| DeepSeek | DeepSeek chat API | DEEPSEEK_API_KEY |
| Groq | Groq chat API | GROQ_API_KEY |
| Ollama (local) | http://127.0.0.1:11434/v1 | No key required |
| LM Studio (local) | http://127.0.0.1:1234/v1 | No key required unless you enabled authentication |
| Custom OpenAI-compatible | Your server's API base URL | COMPATIBLE_API_KEY, or enter a key in Settings |

Start your local model server and load/download a model there first. Copy its exact model ID into Settings; the harness does not install models or start their servers. A downloaded model served locally can generate text without an external text provider. The model must handle the story context and JSON instructions; model size and context capacity affect reliability. Images and any separately selected hosted services still use network APIs.

## Image provider connections

The image menu supports OpenAI Images, NovelAI, Stability AI, AUTOMATIC1111/Forge, Fooocus, ComfyUI, and a Custom OpenAI-compatible images endpoint. Stability uses its Stable Image Core endpoint and supports the selected aspect ratio; it does not receive reference images. Reference image conditioning is currently an OpenAI Images feature. Local UI connections use their documented HTTP APIs: AUTOMATIC1111/Forge uses `/sdapi/v1/txt2img`, Fooocus uses the Fooocus-API extension's `/v1/generation/text-to-image`, and ComfyUI submits an API-format workflow to `/prompt` and retrieves its first output image. Local HTTP is restricted to this computer; use HTTPS for a remote server.

The custom image connection expects an OpenAI-style `POST /images/generations` response containing `data[0].b64_json` or `data[0].url`. This makes it useful for local servers and gateways that expose that compatibility layer, but it is not a universal adapter for arbitrary image APIs. Stability and custom image keys use `STABILITY_API_KEY` and `COMPATIBLE_IMAGE_API_KEY` in `.env`; browser keys are memory-only. Local UI keys are optional and are only needed when you put an authenticated gateway in front of the UI.

**ComfyUI setup:** in ComfyUI, export your workflow in API format. Paste it into the harness's ComfyUI workflow field, then replace the positive text node with the literal `{{prompt}}` placeholder and the negative text node with `{{negative_prompt}}` if desired. The harness keeps the workflow you provide, submits it for each image request, waits for completion, and downloads the first image output. This deliberately avoids guessing which nodes in a custom graph are checkpoints, samplers, or text encoders.

The API base URL is different from the custom roleplay backend URL. For local/compatible models, fill the **Provider API base URL**, usually ending in /v1. Leave **Custom roleplay backend URL** blank. Hosted presets have fixed official URLs. HTTP is allowed only on loopback (localhost, 127.0.0.1, or ::1); use HTTPS and Custom OpenAI-compatible for a server elsewhere.

New hosted presets start with an empty model field so you can enter a currently available model from your account. Switching text providers clears the browser text key, model, base URL, output-mode override, and custom roleplay backend; switching image providers also clears the image key, image base URL, ComfyUI workflow, and model so connection details cannot cross services. Enter the new connection's details. OpenAI and NovelAI retain their existing default model suggestions. Local UI presets use their usual loopback ports as placeholders. Session files retain model/compatibility settings, but imported external files cannot set a provider base URL or ComfyUI workflow. Re-enter those values after importing.

**Structured output compatibility:** local presets default to JSON schema; hosted chat presets default to JSON mode. Use JSON schema where your model supports it. If a server rejects response_format, choose Prompt only. Prompt only still asks for the required JSON structure but cannot enforce it during generation. The harness parses and normalizes replies and reports unusable or truncated output rather than fabricating a scene. There is no automatic retry that silently switches modes and spends more credits.

**NovelAI compatibility:** NovelAI's OpenAI-compatible text endpoint does not enforce the JSON schema used by OpenAI. The harness sends an explicit JSON contract, disables thinking for these structured turns, keeps structured turns within NovelAI's documented output allowance, and trims only the provider copy of oversized attached profiles or scene context. Saved sessions and exports keep their full text. It strips common reasoning wrappers and keeps a plain-prose response as narration if the model ignores the JSON shell. <code>glm-4-6</code> is the default model; enter the exact model ID available to your account. If NovelAI still returns an empty choice, the error includes its stop reason and token metadata so you can tell whether to shorten the context or change the model. See NovelAI's [Generation API documentation](https://docs.novelai.net/en/scripting/generation-api/) for current model and parameter availability.

**Story formatting:** Markdown mode is on by default and is display-only. It supports <code>*italics*</code>, <code>**bold**</code>, <code>~~strikethrough~~</code>, inline code, <code># headings</code>, and <code>- lists</code> in generated narration, dialogue, bubbles, and pause text. The renderer escapes HTML before adding those safe tags, and the underlying text remains unchanged in saves and exports. Switch to Plain text when a provider's markers should remain literal.

**Party asides:** Bubbles are optional short comments beside a character's portrait, separate from the full reply and transcript. A `speech` bubble is an audible aside; a `thought` bubble is an unspoken NPC reaction. They can be dismissed individually, and the prompt asks the model to leave them empty unless they add information rather than repeat the scene.

**TEST LOCAL CONNECTION** checks the harness server and configured-key presence. It does not validate the model server, provider account, model access, or generation quality. These adapters have mock protocol tests and local HTTP integration tests; live hosted calls and actual Ollama/LM Studio model generation have not been validated in this release.

API references: [Claude](https://platform.claude.com/docs/en/api/http/messages/create), [Gemini](https://ai.google.dev/gemini-api/docs/openai), [OpenRouter](https://openrouter.ai/docs/quickstart), [DeepSeek](https://api-docs.deepseek.com/guides/json_mode/), [Groq](https://console.groq.com/docs/overview), [Ollama](https://docs.ollama.com/api/openai-compatibility), [LM Studio](https://lmstudio.ai/docs/developer/openai-compat), [ComfyUI server routes](https://docs.comfy.org/development/comfyui-server/comms_routes), [AUTOMATIC1111 API](https://github.com/AUTOMATIC1111/stable-diffusion-webui/wiki/API), [Fooocus-API](https://github.com/mrhan1993/Fooocus-API/blob/main/docs/api_doc_en.md).
