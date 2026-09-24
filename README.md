# Party Harness

A local browser app for roleplaying with a customizable party of AI characters. Write an action, follow the scene, and let characters react in their own voices. Edit their sheets, correct the story, track relationships and inventory, and optionally generate scene art.

It is not an online service and never asks you to sign in. You run it yourself, so your story stays as private as you want it — see [Local by design](#local-by-design).

See [CHANGELOG.md](CHANGELOG.md) for versioned updates and release notes.

This is a working prototype. It runs on your computer, but text generation can use a hosted provider or a model running on your computer. Hosted generation needs your own API access and may cost money. Images use a separate image provider, either hosted or a compatible server on your computer. You can explore the interface and edit characters without a key.

## Download a release

For the easiest setup, use the [GitHub Releases page](https://github.com/4thkira/party-harness/releases). Open the newest non-draft release, download `party-harness-public.zip` from **Assets**, and extract it. Releases are the tested snapshots intended for users. **Code → Download ZIP** downloads the current `main` branch instead, which may contain work that has not been released yet.

Read [CHANGELOG.md](CHANGELOG.md) to see what changed between versions. Bug-fix releases increment the last number (`v0.1.1`), feature releases increment the middle number (`v0.2.0`), and breaking changes increment the first number (`v1.0.0`).

Every release remains available as its own dated snapshot. The GitHub Releases page keeps each version's notes and download; the changelog is the complete chronological index and links each version to its release. `Unreleased` describes changes on `main` that have not been packaged yet.

## The very simple version

If you have never used a computer program like this before, that is okay. Here is the whole idea:

1. Download the ZIP file from the [Releases page](https://github.com/4thkira/party-harness/releases). A ZIP file is just a box containing the program's files.
2. Open the ZIP file and choose **Extract all**. This makes a normal folder. Keep all of the files inside that folder together.
3. Install [Node.js](https://nodejs.org/) if you do not already have it. Node.js is the small helper that lets Party Harness run. You only need to install it once.
4. Open the new folder. On Windows, double-click **Start Party Harness.cmd**. A black window may appear. Leave it open; it is the program's engine.
5. Open your web browser — Chrome, Edge, Firefox, or another browser — and go to **http://127.0.0.1:8787/**. This address means “the program running on this computer.”
6. Inside Party Harness, open **SETTINGS**. Choose where the AI's text should come from and enter that service's API key if it asks for one. Then press **CHECK CONNECTION + LIST MODELS** and pick a model from the list. An API key is a password-like code from that service; Party Harness does not provide one.
7. Click **NEW SESSION**, choose a scenario, type what you want your character or the party to do, and click **SEND TURN**.

If you only want to look around first, you can open the app and edit characters without an API key. You need a working text connection when you want the AI to write a response. When you are finished, close the black window or press **Ctrl+C** in it. Next time, double-click **Start Party Harness.cmd** again.

### API keys, explained gently

Party Harness is the part that remembers your characters, shows the webpage, and keeps track of the story. It does not contain an AI brain of its own. A **text provider** is another company or program that supplies the AI's writing. Party Harness asks that provider for a response when you click **SEND TURN**.

An **API key** is a private code that proves to a provider that you are allowed to use it. Think of it like a ticket or password for computer programs. You get the key from the provider, not from Party Harness:

1. Choose a text provider in Party Harness's Settings. The provider list later in this README explains the choices.
2. Visit that provider's own website and create an account if you do not have one.
3. Look for a page called **API keys**, **Developer**, or **Your keys**. The exact name and location are different for every provider.
4. Create a new key, then copy it immediately. Many providers show the full key only once.
5. Paste it into the matching API key box in **SETTINGS → Text generation connection**. Do not put quotation marks around it.
6. Press **CHECK CONNECTION + LIST MODELS**. If the key works, the **Model** box offers the models your provider lets you use; pick one. A model is the particular AI you are asking to write. If the check says the key was rejected, copy it again from the provider's website.
7. Save or close Settings, then try **SEND TURN**.

Some providers require payment information or charge based on how much text you generate. Some give new accounts a small amount of free use, and some do not. Read the provider's own pricing and usage pages before creating a key. Party Harness cannot tell you whether a key has money or permission behind it.

Never post an API key in a screenshot, chat message, GitHub issue, or public file. If you accidentally share one, go back to the provider's API-key page and delete or revoke it, then make a new one. Your Party Harness key box is temporary: keys typed there disappear when you refresh the page.

### What is a `.env` file?

If you do not want to paste your key every time, you can save it in a file named `.env`. This is just a small plain-text settings file placed beside `server.js`. It is not a program and you do not open it in the browser.

The simplest way to make one is to paste your key in **SETTINGS** and press **SAVE KEY TO .ENV**; Party Harness creates the file for you. The steps below are for doing it by hand.

1. In the Party Harness folder, find `.env.example`.
2. Make a copy of it in the same folder.
3. Rename the copy to exactly `.env` — not `.env.txt`.
4. Open `.env` in Notepad. Remove the `#` from the setting you need and put your key after the `=` sign. For example: `OPENAI_API_KEY=put-your-key-here`.
5. Save the file and restart Party Harness by closing and reopening **Start Party Harness.cmd**.

On Windows, File Explorer may hide the ending of filenames. If your new file is secretly called `.env.txt`, Party Harness notices and says so in its black window and in Settings. Turn on **View → Show → File name extensions**, then rename it, or paste your key in Settings and press **SAVE KEY TO .ENV**, which copies what you wrote in `.env.txt` into a proper `.env`. Keep `.env` private. It is normally ignored by Git, but you should still check before sharing the folder.

You do not need an API key for Ollama or LM Studio when the model is running on your own computer. Those programs are local providers. You still need to install and start them, download a model there, and enter that model's exact name in Party Harness.

### OpenRouter: a complete example

OpenRouter is a website that gives you one connection for many different AI models. This makes it a useful first hosted provider to try. The following example assumes you are using the Party Harness webpage, not writing code.

1. Go to [OpenRouter](https://openrouter.ai/) and create an account.
2. Open OpenRouter's [API key page](https://openrouter.ai/settings/keys), create a key, and copy it. Treat this key like a password. Do not paste it into a public post.
3. In Party Harness, open **SETTINGS → Text generation connection** and choose **OpenRouter**.
4. Paste the key into the API key box. The provider API base URL should be `https://openrouter.ai/api/v1`; leave **Custom roleplay backend URL** blank.
5. Press **CHECK CONNECTION + LIST MODELS**, then pick a model in the **Model** box, or type an exact model ID from OpenRouter's [models page](https://openrouter.ai/models). A model ID looks like `company/model-name`.
6. Save or close Settings, start a new session, and click **SEND TURN**.

The model name is not your account name, your API key, or the model's friendly title. Copy the model ID exactly. If you change models later, replace only the model ID; you can keep the same OpenRouter key.

### OpenRouter without paying: use a free model

OpenRouter has models marked **(free)**. You can also enter `openrouter/free`, which is a router that chooses an available free model for you. This is the easiest free option because you do not have to guess which free model is currently available.

To try it:

1. Create an OpenRouter account and API key as described above. “Free model” means the model request costs $0; you may still need an OpenRouter account and key so the service knows who is making the request.
2. In Party Harness, choose **OpenRouter** in **SETTINGS → Text generation connection**.
3. Paste your OpenRouter key. Leave the provider API base URL at `https://openrouter.ai/api/v1` and leave **Custom roleplay backend URL** blank.
4. Enter exactly `openrouter/free` in the **Model** box.
5. Try a short, simple turn first. Free models can be busy, slower, less consistent, or temporarily unavailable.

Instead of `openrouter/free`, you can choose a particular free model. After **CHECK CONNECTION + LIST MODELS**, free models are marked **(free)** in the Model box list, or you can copy an exact model ID from OpenRouter's [free-model list](https://openrouter.ai/models?pricing=free). Some model IDs also accept a `:free` ending. The list changes over time, so do not worry if an example model from an older guide is gone.

Free does not mean unlimited. OpenRouter documents lower rate limits and availability for free models, and those limits can change. Free models may also produce less reliable structured responses, which Party Harness needs in order to keep story text, choices, checks, and world-state updates separate. If `openrouter/free` gives an unusable-response error, try a different current free model that lists structured-output support, or switch to a paid model.

**CHECK CONNECTION + LIST MODELS** confirms that OpenRouter accepts your key and shows which models exist right now, and it says so when your key is on OpenRouter's free tier. It cannot promise that a free model has capacity at the moment you play, so the final test is still sending a turn.

### Image generation for beginners

Text generation and image generation are two separate connections. One writes the scene; the other draws a picture. You can use Party Harness for text without setting up images, and you can set up images later. Image generation happens only when you click **GENERATE IMAGE**; it does not happen automatically after every turn.

To make a picture, Party Harness takes the current scene and your visual instructions — for example, “storybook painting, warm candlelight, a rainy castle window” — and sends them to the image provider you selected. The result appears in the image area. Image generation may cost money or use a local computer's time and electricity.

#### Example: use a hosted image provider

OpenAI Images is the simplest hosted example in this app:

1. Make sure you have an OpenAI account and an API key. The [OpenAI image-generation guide](https://platform.openai.com/docs/guides/images) explains the provider side. Image requests are billed separately from ordinary ChatGPT use according to OpenAI's current pricing.
2. In Party Harness, open **SETTINGS → Scene generation** and choose **OpenAI Images API**.
3. Leave the image model as the suggested value unless OpenAI's current documentation says your account should use a different one. The current suggestion is `gpt-image-2`.
4. Paste an image key into **Image API key / token**. If your text provider is also OpenAI and you leave this box blank, Party Harness can reuse the OpenAI text key; using the separate box makes it clearer which key is being used.
5. Choose an image shape, such as **Landscape**, and optionally write a style in **Image prompt guidance / style**.
6. Start or continue a session, then click **GENERATE IMAGE**. A short first prompt is a good test.

You do not need to understand “negative prompts” or reference images to begin. Try describing the subject, place, lighting, mood, and art style in ordinary words. You can add a reference image later; the reference-image features currently work with OpenAI Images only. See the [OpenAI Images documentation](https://platform.openai.com/docs/guides/images) for provider-specific limits and prices.

#### Example: generate images on your own computer

For a no-per-image-API-cost setup, use a local image program such as [AUTOMATIC1111](https://github.com/AUTOMATIC1111/stable-diffusion) / [Forge](https://github.com/lllyasviel/stable-diffusion-webui-forge), [Fooocus](https://github.com/lllyasviel/Fooocus), or [ComfyUI](https://github.com/comfyanonymous/ComfyUI). “Local” means the model and the picture-making work stay on your computer. It does not mean the setup is effortless: you need enough storage, and a computer with a suitable graphics card is strongly recommended. The model download can be large.

The easiest local connection to explain is AUTOMATIC1111 or Forge:

1. Install one of those programs by following its own instructions. Start it and leave its server window open.
2. In its startup options, enable its API if the program requires that. Its API address is usually `http://127.0.0.1:7860`.
3. In Party Harness, open **SETTINGS → Scene generation** and choose **AUTOMATIC1111 / Forge API**.
4. Enter `http://127.0.0.1:7860` in **Image API base URL**. Do not add `/sdapi/v1/txt2img`; Party Harness adds that part itself.
5. Leave **Image API key / token** blank unless you deliberately put a login-protected gateway in front of the local server. Choose the model already loaded by the local program.
6. Write a visual direction, start a session, and click **GENERATE IMAGE**.

There is no hosted image-provider bill for this local route, but it still uses your computer's electricity and hardware. If you use ComfyUI instead, choose **ComfyUI workflow API** and paste an API-format workflow containing the literal `{{prompt}}` placeholder. ComfyUI is powerful but is a more advanced first setup. Local image programs do not need an API key; they must be installed, running, and loaded with a model before Party Harness can contact them.

### A calm first session

You do not need to understand every setting before you begin. For a first test, use one text provider, leave image generation turned off or use the image setup above, and keep the request small:

1. Open **NEW SESSION** and choose the scenario that sounds closest to what you want.
2. Read the party list. The first character is the one you play in **Party-member mode**. If you would rather direct everyone from outside the story, choose **Unseen DM**.
3. Type one clear action. For example: `I enter the old greenhouse, look around carefully, and ask Rowan what they know about this place.`
4. Click **SEND TURN** and wait. The provider may take a little while. Do not click the button repeatedly while it is working.
5. Read the response. If the story stops at a choice or a stat check, follow the button it gives you. If you do not like what happened, **UNDO** goes back one exchange; **REGENERATE** asks the provider for a new version.

You can also start with something even more direct:

```text
I am new to this story. Please describe the room, introduce the party, and end by asking me what I want to do.
```

The AI cannot read your mind, so ordinary detail helps. Say what your character does, who they are talking to, and anything important they are trying to accomplish. You do not need special prompt syntax. Short turns are easier to understand and usually cheaper or faster than very large ones.

### Things that look unusual but are normal

- The black terminal window is not another copy of the app. It is the engine that keeps the webpage running, so leave it open.
- `127.0.0.1` and `localhost` mean “this computer.” They are normal addresses for a program running privately on your machine.
- A loading message means the harness is waiting for the selected provider. A slow response is not automatically a frozen app; use **Cancel** if you need to stop waiting.
- A model ID is the provider's technical name for an AI. It may look less friendly than the name shown on the provider's website.
- A stat check is a story moment where the harness rolls for an uncertain outcome. You are not expected to calculate anything; the screen tells you what to do.
- A memory proposal is a suggestion for you to review. It is not silently changing your character or story.

### Save your story before experimenting

Party Harness saves its current work in your browser on this computer, but browser storage is not a complete backup. Before deleting browser data, changing browsers, or moving to another computer, use **Export session JSON** and keep that file somewhere safe. That file can be imported later to restore the session. **Export story (Markdown)** is good for reading or sharing a transcript, but it cannot restore the playable session.

It is also fine to make a “test” session while learning. Try settings and prompts there first, then create a fresh session for the story you want to keep. Generated images are not included in session exports, so save any images you want to keep separately.

### If your first turn does not work

First check the three simplest things: the black server window is still open, you are using the exact `http://127.0.0.1:8787/` address, and your selected provider has the correct key and model ID. If you are using a local provider, make sure its own program is running too. Do not paste your API key into a bug report; copy the ordinary error message instead. The fuller [Troubleshooting](#troubleshooting) table covers the next things to try.

## Start here

1. Install Node.js 22 or newer. Check it by opening a terminal and running `node --version`.
2. If you did not already download a release above, use **Code → Download ZIP**, then extract it to a folder. Keep the supplied files together.
3. On Windows, double-click **Start Party Harness.cmd**. On macOS/Linux, open a terminal in the extracted folder and run `node server.js`. There is no `npm install` step.
4. Keep that terminal open and visit **http://127.0.0.1:8787/** in your browser. Open the address, not the HTML file itself.
5. Open **SETTINGS → Text generation connection**. Choose a text provider and enter its API key if needed (NovelAI uses a Persistent API token). Press **CHECK CONNECTION + LIST MODELS** and pick a model, or type an exact model ID. For local models, see the connection table below. Leave the custom roleplay backend URL blank.
6. Open **NEW SESSION**, choose a scenario, and review your party. Write an action and use **SEND TURN**. **HELP / START HERE** explains the controls while you play.

The included model name is a configurable default, not a promise of access. Select a model your provider actually supports. **CHECK CONNECTION + LIST MODELS** asks your provider for its model list: it confirms the key and address without generating anything, and the connection dot turns green when it succeeds. It cannot tell whether your account has credit left.

To stop the app, press Ctrl+C in its terminal. Use the launcher again next time.

## Keep your key between launches (optional)

Keys typed in Settings disappear when you refresh. The easy way to keep one is to paste it into the API key box and press **SAVE KEY TO .ENV**. Party Harness writes it into a `.env` file beside `server.js`, where it loads automatically from then on, even after a restart. **FORGET SAVED KEY** removes it again. Image keys have their own **SAVE IMAGE KEY TO .ENV** button.

To edit the file yourself instead:

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
| Stat check | Rolled by the harness on your computer, not by the provider. Roll-over on a 1-100 die: a high roll is a good roll. Rolling sends the result back for the story to continue, so a turn that ends in a check costs a second provider request. The roll is fixed when the check appears, so undoing and rolling it again gives the same number. See [How checks work](#how-checks-work). |
| Undo / regenerate | Undo restores the previous exchange; regenerate retries its action with a new provider request. The reply it replaces is kept: ‹ › beside the turn buttons flips between up to 10 replies to the same action, and each brings back exactly what it changed in the world. If a regenerate fails or you cancel it, the previous reply comes back. Undo removes the turn with all of its replies. |
| World state | Editable inventory, conditions, relationships, objectives, progress counters (“clocks”), and facts (“flags”). |
| Relationship web | The grid at the top of the World tab. Each row is one character's feelings toward the others, one dimension at a time (affection, trust, respect, tension, fear, obligation). Pick a square to edit it, or a · square to start a relationship nobody has recorded yet. ≠ marks a bond that runs much stronger one way, and a heavy border marks one that changed this turn. |
| Lorebook | Reference entries about your world, sent only when one of their keywords comes up. See [Lorebook](#lorebook). |
| Memory proposal | A suggested reaction, relationship memory, or character development for you to review. It does not automatically rewrite a character. |
| Pinned canon | Your explicit continuity facts. Review AI summaries and correct mistakes when needed. |
| Sessions | Named saves, session import/export, and readable story exports. |
| Story text formatting | Markdown mode safely renders emphasis, headings, lists, and inline code; Plain text keeps the original markers visible. |
| Column dividers | On desktop, drag the narrow dividers between Story, Image, and Party to choose how much room each gets. Arrow keys nudge a focused divider; double-click resets both. The proportions travel with saves and exports. |
| Party banter | Requests a short in-character exchange without advancing the turn or applying world-state changes. It is still a provider request. |
| Downtime | Lets the party spend some time together with nobody directing them: a short scene of the characters talking and doing small things, driven by their own personalities and relationships. It cannot move the plot, change items or facts, or stop for a choice or check. If it changes how the characters feel about each other, each change comes back as a proposal in the World tab (the tab shows a count) to **APPLY** or **DISMISS**, and ? marks its square on the relationship web; nothing changes until you choose, and **UNDO EDIT** reverses the choice. In party-member mode your own character's feelings are never proposed. Downtime is a turn: undo, regenerate, and ‹ › work on it. |
| Bookmark | Saves the current scene title, location, turn, and a short excerpt under the History tab. |
| Portrait expressions | Add several images to a character sheet, then choose which expression is shown as that character's current portrait. |

The right-hand rail is split into **Party**, **World**, **Lore**, **History**, and **Trace** tabs. World opens on the relationship web, then the rest of the scene's state; a number on the tab counts suggestions waiting for your review. History keeps scene bookmarks and records the directional relationship changes applied by generated turns.

### Trace

The **Trace** tab records each request to the text provider: how long it took, what the rules layer applied or refused, which lore went with it, and the tokens the provider reported (input, the part of it served from the provider's cache, output, and reasoning, when the provider says). The top line adds up the recorded turns, which is a quick way to see what a session is costing.

Tick **Keep each turn's exact exchange** to hold on to exactly what the harness sent to the provider and what came back, including a provider's own error message when a turn fails. **VIEW EXCHANGE** shows it and **DOWNLOAD JSON** saves it. It stays in that browser tab only: it is never saved or exported with the session, it is gone on reload, and unticking the box lets go of what was held. API keys are sent in request headers and never appear in it.

### Lorebook

The **Lore** tab holds reference entries about your world — places, people, factions, history, rules of magic — each with a few keywords. An entry is sent to the text provider only when one of its keywords appears in the last eight lines of the story (a speaker's name counts) or in the action you send, so a long lorebook costs nothing until it becomes relevant. Keywords match whole words in any letter case: `gate` finds "the Gate" but not "gatekeeper". Tick **Always include** for the few entries every turn should see.

What is sent each turn is capped at 6,000 characters. **Always include** entries go first, then matching entries in list order, so use ↑ ↓ to put the ones that matter most at the top. The tab shows which entries are in play for the next turn and which matched but did not fit, and the Trace tab lists the entries each turn actually sent.

**IMPORT** reads this harness's lorebook exports, SillyTavern World Info files, NovelAI lorebooks, and the lorebook built into a character card. Keywords written as regular expressions are skipped (the import says how many) rather than run, because a pattern from someone else's file could freeze the page. The lorebook is saved with the session; **New session** keeps it unless you untick **Keep the lorebook**.

## Local music, ambience, and interface skins

Create `music/`, `ambience/`, and `skins/` folders beside `server.js` (the harness also works when they are absent). Put MP3, OGG, WAV, M4A, or FLAC files in the two audio folders, then use the controls below the scene image. Music and ambience can play together at separate volumes. Browsers vary in which audio formats they decode, so MP3 and OGG are the most portable choices.

Put CSS files in `skins/`, open **Settings → Appearance**, and choose **Refresh local library**. A skin is ordinary CSS loaded after the built-in styles, so it can override colors, borders, spacing, and typography. Treat a downloaded skin as code you should read before using. These three folders are ignored by Git and excluded from public release archives, keeping personal media and styling local.

Autosave and named saves live in this browser on this computer, and are also kept as files in a `saves/` folder beside `server.js`. The files are what bring your work back after you clear site data or open the harness in another browser or on another port: an empty browser restores the last workspace from `saves/autosave.json` on its own, and **SESSIONS** lists saves that exist only as files. Only files the harness wrote itself are restored with their connection settings; a session file copied in from elsewhere loads like an import. You can turn the files off in **SETTINGS → Local workspace persistence**. **Export session JSON** for a portable backup; **Export story (Markdown)** is a readable transcript, not a restorable session.

Session exports exclude API keys and generated image data. Save generated art separately. Character sheets, uploaded portraits, and story text may be personal, so review your session files before sharing them.

Your selected provider receives the context needed for generation, including relevant character profiles and story information. Reference images are sent when used for image generation. What that means for your privacy, and how to avoid it entirely, is covered in [Local by design](#local-by-design). The included server is intended for local use; do not deploy it as a public service without redesigning access control.

## Local by design

Party Harness is not an online service. There is no hosted version, no account to create, no sign-in, no telemetry, and no server of ours that your story passes through. GitHub hosts the source, not a working backend. You download it, run it on your own computer, and open it in your own browser. Your saves live in that browser and in files you control, and nothing is uploaded, moderated, ranked, or retained by this project.

That is deliberate. Roleplay gets personal — a quiet character study, a long-running campaign, something explicit, something you would simply rather not explain to a content reviewer. Running the harness yourself means nobody is looking over your shoulder, and the project has no opinion about what your scenes contain.

**Where your privacy actually ends is your text provider.** The harness is local, but generation is not automatically local. If you point it at a hosted provider, that provider receives your prompts — character sheets, story context, and the scene you are writing — and applies its own policies, moderation, and retention to them. That is a real distinction and worth planning around:

- **A model running on your computer** (Ollama, LM Studio, or any OpenAI-compatible local server) keeps everything on your machine. Nothing leaves it, so there is no provider policy to satisfy and no third party with a copy. This is the only configuration that is private end to end.
- **A hosted provider** is a service you have an account with, bound by its terms. Providers differ enormously in what they permit; some are built with adult fiction in mind, others restrict it and may act on your account. Check the terms of the provider you choose rather than assuming, and remember the same applies to hosted image generation.

Neither choice is wrong. Hosted models are usually stronger and easier to start with; a local model trades some capability for the guarantee that your story never leaves the room. Pick per session — the provider is a setting, not a commitment.

## How checks work

When a scene reaches something that could genuinely go either way, the engine ends its turn with a **check**: a named stat and a difficulty from 0 to 100. It does not decide the outcome. Your computer rolls, and the result is sent back for the story to continue from.

Checks are **roll-over on a 1-100 die**. A high roll is always a good roll.

The target comes from the acting character's stat and the difficulty the scene asked for:

```
success chance = character's stat − difficulty + 50      (clamped to 5–95)
target         = 101 − success chance
success        = roll ≥ target
```

The clamp is why nothing is ever a certainty: even a hopeless attempt keeps a 5% chance, and even an easy one can still fail 5% of the time. Difficulty 50 is an even chance for an average stat of 50; a higher difficulty means a higher target.

| Character stat | Difficulty | Needs | Succeeds |
| --- | --- | --- | --- |
| 50 | 50 | 51 or over | 50% |
| 80 | 40 | 11 or over | 90% |
| 30 | 70 | 91 or over | 10% |

Every surface states the threshold the same way — the dice overlay, the transcript, the World tab, and the text sent back to the engine all read `rolled 80, needed 60 or over`, so a result never has to be inferred from a bare comparison.

A few things follow from the harness owning the roll rather than the model:

- **The result is fixed when the check appears,** not when you press ROLL. Undoing back to a check and rolling it again gives the same number, so a check cannot be quietly rerolled into a better outcome.
- **The engine is told the outcome is already resolved** and must narrate it as written. It cannot recompute the result or talk you out of a failure.
- **The three stats are per-session,** defined by your scenario rather than fixed attributes. A generated session invents its own, and each carries a description of when it applies.
- **If a scene asks for a stat this session does not define,** the harness rolls the first stat instead and says so in the transcript and to the engine, rather than silently substituting one.

A turn that ends in a check costs a second provider request, since the result has to go back for the scene to continue.

## Bring your own characters

Edit sheets directly in the party sidebar, or place Markdown (`.md`) profiles in `characters/`. Use **REFRESH FILES**, choose a profile, and optionally **PROCESS WITH LLM** to suggest sheet fields. Review those fields before saving. Processing a profile is a provider request.

`characters/example.md` shows a simple format. You can also write ordinary prose. The supplied roster is an example; replace it with your own characters when you are ready.

**Character cards** from SillyTavern, chub, and similar sites import too. Open a character sheet (or **+ ADD PARTY MEMBER**), choose **IMPORT CHARACTER**, and pick the card: V1, V2, and V3 cards work, as JSON or as the PNG they usually come in. The card's name and short personality go onto the sheet, its image becomes the portrait, and its description, scenario, and example dialogue are attached as the character's reference profile, which the engine is told to treat as reference material rather than instructions (see the note below on what that does and does not protect). `{{char}}` and `{{user}}` are filled in with the character's name and yours (or "the player" when you direct as the DM). Cards do not record pronouns, so add them yourself; **PROCESS WITH LLM** can fill the rest of the sheet from the card. A card's built-in lorebook joins the [Lore tab](#lorebook) when you save the character.

Some things in a card are deliberately left out: its system prompt and post-history instructions, which would compete with this harness's own instructions, and its greetings, which are written to open a one-on-one chat rather than a party scene. The import tells you when a card had any of them.

**About profiles you did not write.** An attached profile is sent to the model as part of the prompt. The harness tells the model to treat it as character reference material and never as instructions, but that instruction is the only thing separating the two: a profile downloaded from elsewhere can contain text written to talk past it and steer the scene, change how characters behave, or try to draw out other context in the session. For profiles you wrote, this does not matter. For a character card from somewhere else, read it before attaching it, the same way you would read a script before running it. The risk is to your story and your session, not to your computer or your key: profiles are never executed, and keys are never placed in the prompt.

## Frequently asked questions

**What is Party Harness?**
It is a local webpage for running roleplay sessions with a party of AI characters. The webpage, character sheets, story controls, and saves run on your computer; the actual writing comes from whichever text provider you connect.

**Do I have to know how to code?**
No. On Windows, the normal routine is to double-click **Start Party Harness.cmd**, leave the black window open, and use the app in your browser. The [very simple guide](#the-very-simple-version) walks through the first setup.

**Why does a local program open in my web browser?**
The browser is simply Party Harness's screen and controls. The address `127.0.0.1` means your own computer, not a public website.

**Why does a black window open? Can I close it?**
That window is the local server — the small engine supplying the webpage to your browser. Leave it open while playing. Closing it stops Party Harness, but does not delete your saves.

**Do I need an API key?**
You need a key for most hosted AI providers. You do not usually need one for a model server running on your own computer. See [API keys, explained gently](#api-keys-explained-gently).

**Can I use Party Harness without paying?**
Yes, with limits or extra setup. OpenRouter offers free models with lower availability and request limits, while Ollama or LM Studio can run a downloaded text model on suitable hardware. See [OpenRouter without paying](#openrouter-without-paying-use-a-free-model). Party Harness itself does not charge you.

**Will Party Harness warn me before a provider charges me?**
No. The provider controls prices, credits, limits, and billing. Party Harness sends a request when you use actions such as **SEND TURN**, **REGENERATE**, **PARTY BANTER**, profile processing, scenario generation, or **GENERATE IMAGE**. Check the provider's usage page and prices yourself.

**Why did my API key disappear?**
Keys pasted into the webpage are intentionally temporary and disappear after a refresh. To keep one between launches, save it privately in a [`.env` file](#what-is-a-env-file).

**Can I use one company for text and another for images?**
Yes. Text and image providers are separate settings. You can also turn off the generated-image area and play entirely with text.

**Do I need image generation to play?**
No. Images are optional and are created only when you click **GENERATE IMAGE**. See [Image generation for beginners](#image-generation-for-beginners) if you want to add them later.

**Where is my story saved?**
In this browser, and as files in the `saves/` folder beside `server.js`. If you clear browser data or come back on a different browser or port, the harness restores your last workspace from that folder by itself, and your named saves appear in **SESSIONS** marked “saves folder only”. Exporting a session JSON is still the way to move a story to another computer.

**How do I move or back up a session?**
Use **Export session JSON**. Import that JSON file later to restore the playable session. **Export story (Markdown)** makes a readable transcript, but cannot restore the session. Generated images must be saved separately.

**Can I add my own characters?**
Yes. Edit the character sheets in the Party sidebar or add Markdown profiles to the `characters/` folder. The included characters are examples, not a required cast. See [Bring your own characters](#bring-your-own-characters).

**Is my story private?**
The app and its browser saves are local, but a hosted provider receives the material needed to generate its response. A model running entirely on your computer is the private end-to-end option. See [Local by design](#local-by-design) for the full explanation.

**Does Party Harness decide what stories I am allowed to write?**
Party Harness does not inspect, upload, or moderate your story. A hosted text or image provider can still apply its own rules to anything sent to it. Local models avoid that provider boundary.

**What should I include when asking for help?**
Say what operating system you use, what you clicked, which provider and model you selected, and the ordinary error message you saw. Never include your API key, private `.env` file, or personal story text you do not want others to read.

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
| My saves seem gone | Open **SESSIONS**: saves kept as files are listed there even in a new browser or on a new port. Check that the `saves/` folder is beside `server.js`, return to the same browser and address, or import an exported session JSON. |

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

Start your local model server and load/download a model there first, then use **CHECK CONNECTION + LIST MODELS** to pick its exact model ID; the harness does not install models or start their servers. A downloaded model served locally can generate text without an external text provider. The model must handle the story context and JSON instructions; model size and context capacity affect reliability. Images and any separately selected hosted services still use network APIs.

## Image provider connections

The image menu supports OpenAI Images, NovelAI, Stability AI, AUTOMATIC1111/Forge, Fooocus, ComfyUI, and a Custom OpenAI-compatible images endpoint. Stability uses its Stable Image Core endpoint and supports the selected aspect ratio; it does not receive reference images. Reference image conditioning is currently an OpenAI Images feature. Local UI connections use their documented HTTP APIs: AUTOMATIC1111/Forge uses `/sdapi/v1/txt2img`, Fooocus uses the Fooocus-API extension's `/v1/generation/text-to-image`, and ComfyUI submits an API-format workflow to `/prompt` and retrieves its first output image. Local HTTP is restricted to this computer; use HTTPS for a remote server.

The custom image connection expects an OpenAI-style `POST /images/generations` response containing `data[0].b64_json` or `data[0].url`. This makes it useful for local servers and gateways that expose that compatibility layer, but it is not a universal adapter for arbitrary image APIs. Stability and custom image keys use `STABILITY_API_KEY` and `COMPATIBLE_IMAGE_API_KEY` in `.env`; browser keys are memory-only. Local UI keys are optional and are only needed when you put an authenticated gateway in front of the UI.

**ComfyUI setup:** in ComfyUI, export your workflow in API format. Paste it into the harness's ComfyUI workflow field, then replace the positive text node with the literal `{{prompt}}` placeholder and the negative text node with `{{negative_prompt}}` if desired. The harness keeps the workflow you provide, submits it for each image request, waits for completion, and downloads the first image output. This deliberately avoids guessing which nodes in a custom graph are checkpoints, samplers, or text encoders.

The API base URL is different from the custom roleplay backend URL. For local/compatible models, fill the **Provider API base URL**, usually ending in /v1. Leave **Custom roleplay backend URL** blank. Hosted presets have fixed official URLs. HTTP is allowed only on loopback (localhost, 127.0.0.1, or ::1); use HTTPS and Custom OpenAI-compatible for a server elsewhere.

New hosted presets start with an empty model field so you can enter a currently available model from your account. Switching text providers clears the browser text key, model, base URL, output-mode override, and custom roleplay backend; switching image providers also clears the image key, image base URL, ComfyUI workflow, and model so connection details cannot cross services. Enter the new connection's details. OpenAI and NovelAI retain their existing default model suggestions. Local UI presets use their usual loopback ports as placeholders. Session files retain model/compatibility settings, but imported external files cannot set a provider base URL or ComfyUI workflow. Re-enter those values after importing.

**Structured output compatibility:** local presets default to JSON schema; hosted chat presets default to JSON mode. Use JSON schema where your model supports it. If a server rejects response_format, choose Prompt only. Prompt only still asks for the required JSON structure but cannot enforce it during generation. The harness parses and normalizes replies and reports unusable or truncated output rather than fabricating a scene. There is no automatic retry that silently switches modes and spends more credits.

**NovelAI compatibility:** NovelAI's OpenAI-compatible text endpoint does not enforce the JSON schema used by OpenAI. The harness sends an explicit JSON contract, disables thinking for these structured turns, keeps structured turns within NovelAI's documented output allowance, and trims only the provider copy of oversized attached profiles or scene context. Saved sessions and exports keep their full text. It strips common reasoning wrappers and keeps a plain-prose response as narration if the model ignores the JSON shell. If NovelAI returns an empty `text` field while its OpenAI-style `logprobs` or converted logprobs contain token strings, the harness reconstructs the visible text before failing. <code>glm-4-6</code> is the default model; enter the exact model ID available to your account. If NovelAI still returns an empty choice, the error includes its stop reason and token metadata so you can tell whether to shorten the context or change the model. See NovelAI's [Generation API documentation](https://docs.novelai.net/en/scripting/generation-api/) for current model and parameter availability.

**Story formatting:** Markdown mode is on by default and is display-only. It supports <code>*italics*</code>, <code>**bold**</code>, <code>~~strikethrough~~</code>, inline code, <code># headings</code>, and <code>- lists</code> in generated narration, dialogue, bubbles, and pause text. The renderer escapes HTML before adding those safe tags, and the underlying text remains unchanged in saves and exports. Switch to Plain text when a provider's markers should remain literal.

**Party asides:** Bubbles are optional short comments beside a character's portrait, separate from the full reply and transcript. A `speech` bubble is an audible aside; a `thought` bubble is an unspoken NPC reaction. They can be dismissed individually, and the prompt asks the model to leave them empty unless they add information rather than repeat the scene.

**CHECK CONNECTION + LIST MODELS** asks the selected provider for its model list, which confirms the harness, the address, and the key without generating anything. Embedding, speech, and image models are left out of the list. It does not test generation quality or account credit. These adapters have mock protocol tests and local HTTP integration tests; live hosted calls and actual Ollama/LM Studio model generation have not been validated in this release.

API references: [Claude](https://platform.claude.com/docs/en/api/http/messages/create), [Gemini](https://ai.google.dev/gemini-api/docs/openai), [OpenRouter](https://openrouter.ai/docs/quickstart), [DeepSeek](https://api-docs.deepseek.com/guides/json_mode/), [Groq](https://console.groq.com/docs/overview), [Ollama](https://docs.ollama.com/api/openai-compatibility), [LM Studio](https://lmstudio.ai/docs/developer/openai-compat), [ComfyUI server routes](https://docs.comfy.org/development/comfyui-server/comms_routes), [AUTOMATIC1111 API](https://github.com/AUTOMATIC1111/stable-diffusion-webui/wiki/API), [Fooocus-API](https://github.com/mrhan1993/Fooocus-API/blob/main/docs/api_doc_en.md).
