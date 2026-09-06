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

// Behavioral checks using the actual browser script and deferred provider replies.
// No credentials, network calls, or existing browser saves are used.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const html = fs.readFileSync(path.join(__dirname, "rp-party-harness-prototype.html"), "utf8");
const script = html.slice(html.indexOf("<script>") + 8, html.indexOf("    async function bootWorkspace()"));

function harness() {
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, { value: "", textContent: "", disabled: false,
      addEventListener() {}, focus() {}, querySelectorAll: () => [],
      classList: { add() {}, remove() {}, toggle() {} } });
    return elements.get(id);
  };
  const context = vm.createContext({ structuredClone, TextEncoder, URL, performance, console, AbortController, crypto: require("node:crypto"), HarnessStorage: require("./harness-storage.js"),
    setTimeout, clearTimeout, setInterval, clearInterval,
    document: { getElementById: element, querySelectorAll: () => [], addEventListener() {} },
    window: { addEventListener() {} }, alert() {} });
  const run = code => vm.runInContext(code, context, { timeout: 1000 });
  run(script);
  run(`
    globalThis.actualRenderNarrative = renderNarrative;
    renderAll = renderVisual = renderNarrative = renderMemoryStatus = renderPromptPreview =
      renderDirtyMarker = announceTurn = () => {};
    scheduleCurrentStatePersistence = () => { globalThis.saved = true; };
    startTurnStatus = stopTurnStatus = () => {};
    state.serverKeys.openai = true;
    state.narrative = Array.from({length: 32}, (_, i) => ({kind: 'body', text: 'line ' + i}));
    state.archive = []; state.storySummary = ''; state.turnCheckpoints = [];
    fetchWithTimeout = () => new Promise(resolve => { globalThis.reply = resolve; });
  `);
  return { run, context, element };
}

for (const mutation of ["undo", "edit", "canon", "session"]) {
  test("late summary cannot overwrite " + mutation, async () => {
    const h = harness();
    const pending = h.run("maybeSummarize()");
    if (mutation === "undo") h.run("restoreTurnCheckpoint(captureTurnCheckpoint('action'))");
    if (mutation === "edit") h.run("state.narrative[0].text = 'corrected'");
    if (mutation === "canon") h.run("state.pinnedFacts = 'new canon'");
    if (mutation === "session") h.run("sessionEpoch += 1");
    h.context.reply({ ok: true, json: async () => ({summary: "stale summary"}) });
    await pending;
    assert.equal(h.run("state.storySummary"), "");
    assert.equal(h.run("state.narrative.length"), 32);
    assert.equal(h.run("state.archive.length"), 0);
  });
}

test("summary folds its captured prefix, preserves new lines, and schedules autosave", async () => {
  const h = harness();
  const pending = h.run("maybeSummarize()");
  h.run("state.narrative.push({kind: 'body', text: 'new turn'})");
  h.context.reply({ ok: true, json: async () => ({summary: "valid summary"}) });
  await pending;
  assert.equal(h.run("state.archive.length"), 18);
  assert.equal(h.run("state.narrative.length"), 15);
  assert.equal(h.run("state.narrative.at(-1).text"), "new turn");
  assert.equal(h.context.saved, true);
});

test("turn completion preserves the next draft", async () => {
  const h = harness();
  h.run("requestLiveTurn = () => new Promise(resolve => { globalThis.turnReply = resolve; }); maybeSummarize = () => {}; state.narrative = [];");
  h.element("response-input").value = "open door";
  const pending = h.run("handleTurn('open door')");
  assert.equal(h.element("response-input").value, "");
  h.element("response-input").value = "look inside";
  h.context.turnReply({ result: {narration: "The door opens."}, requestBytes: 123 });
  await pending;
  assert.equal(h.element("response-input").value, "look inside");
  assert.equal(h.run("state.turnTraces.at(-1).status"), "success");
  assert.equal(h.run("turnInFlight"), false);
});

test("image response cannot land in a different session", async () => {
  const h = harness();
  h.run("buildImageReferences = () => []; buildImagePrompt = () => 'original prompt';");
  const pending = h.run("requestGeneratedImage()");
  h.run("sessionEpoch += 1; state.generatedImage = ''; state.imageStatus = '';");
  h.context.reply({ ok: true, json: async () => ({imageDataUrl: "data:image/png;base64,AAAA"}) });
  await pending;
  assert.equal(h.run("state.generatedImage"), "");
  assert.equal(h.run("state.imageStatus"), "");
  assert.equal(h.element("generate-image").disabled, false);
});

test("image records the submitted prompt even if the scene changes", async () => {
  const h = harness();
  h.run("buildImageReferences = () => []; buildImagePrompt = () => 'original prompt';");
  const pending = h.run("requestGeneratedImage()");
  h.run("buildImagePrompt = () => 'later scene';");
  h.context.reply({ ok: true, json: async () => ({imageDataUrl: "data:image/png;base64,AAAA"}) });
  await pending;
  assert.equal(h.run("state.generatedImagePrompt"), "original prompt");
});

test("opening scene cannot be undone; saved actions enable regeneration", () => {
  const h = harness();
  h.run("state.narrative = [{kind:'label',text:'Opening'},{kind:'body',text:'Keep me'}]; renderTurnControls();");
  assert.equal(h.element("undo-turn").disabled, true);
  h.run("undoLastTurn()");
  assert.equal(h.run("state.narrative.length"), 2);
  h.run("state.lastAction = ''; state.narrative.push({kind:'choice',text:'Go'}); renderTurnControls();");
  assert.equal(h.element("regenerate-turn").disabled, false);
});

test("duplicate maximum-length stat IDs terminate and stay unique", () => {
  const h = harness();
  const ids = h.run("normalizeStatDefinitions(Array.from({length:5}, () => ({id:'x'.repeat(80),name:'Stat'}))).map(s=>s.id)");
  assert.equal(new Set(ids).size, 5);
  assert.ok(ids.every(id => id.length <= 80));
});

test("duplicate maximum-length character IDs stay within their schema", () => {
  const h = harness();
  const ids = h.run("ensurePartyIds(Array.from({length:5}, () => ({id:'x'.repeat(64),name:'Character'}))).map(s=>s.id)");
  assert.equal(new Set(ids).size, 5);
  assert.ok(ids.every(id => id.length <= 64));
});

test("full pinned canon keeps the memory candidate intact", () => {
  const h = harness();
  let pin;
  h.element("world-state-panel").querySelectorAll = selector => selector === "[data-pin-memory]" ? [{ dataset: {pinMemory: "0"}, addEventListener: (_, callback) => { pin = callback; } }] : [];
  h.run("state.pinnedFacts = 'x'.repeat(8000); state.memoryCandidates = [{scope:'scene',text:'Keep this fact'}]; renderWorldState();");
  pin();
  assert.equal(h.run("state.pinnedFacts.length"), 8000);
  assert.equal(h.run("state.memoryCandidates[0].text"), "Keep this fact");
});

test("character file resolver rejects symlink escape and lexical traversal", () => {
  const server = fs.readFileSync(path.join(__dirname, "server.js"), "utf8");
  const start = server.indexOf("const CHARACTER_DIR =");
  const end = server.indexOf("async function listCharacterMarkdown", start);
  const root = path.resolve("fixture-root");
  const context = vm.createContext({ path, __dirname: root, fs: {
    statSync: () => ({isDirectory: () => true}),
    realpathSync: file => file.endsWith("escape.md") ? path.resolve("elsewhere", "private.md") : file
  }});
  vm.runInContext(server.slice(start, end), context);
  assert.equal(vm.runInContext("characterFilePath('characters/escape.md')", context), "");
  assert.equal(vm.runInContext("characterFilePath('characters/../private.md')", context), "");
  assert.equal(vm.runInContext("characterFilePath('characters/valid.md')", context), path.join(root, "characters", "valid.md"));
});

test("effects happen on reveal, exactly once, and undo restores them", () => {
  const h = harness();
  h.run(`
    state.narrative = [];
    globalThis.before = captureTurnCheckpoint('enter');
    state.beatQueue = prepareBeatQueue({beats:[
      {kind:'narration',text:'You enter.',stateChanges:{flagChanges:[{key:'entered',value:'yes'}]}},
      {kind:'pause',prompt:'Look closer?',pauseType:'continue'},
      {kind:'narration',text:'You find a key.',stateChanges:{inventoryChanges:[{operation:'add',itemId:'key',name:'Key',quantity:1}]}}
    ]}, 'fallback', []);
    processBeatQueue();
  `);
  assert.equal(h.run("state.worldState.flags.entered"), "yes");
  assert.equal(h.run("state.worldState.inventory.length"), 0);
  h.run("state.pendingPause = null; processBeatQueue(); processBeatQueue();");
  assert.equal(h.run("state.worldState.inventory[0].quantity"), 1);
  h.run("restoreTurnCheckpoint(before)");
  assert.equal(h.run("state.worldState.inventory.length"), 0);
  assert.equal(h.run("Object.keys(state.worldState.flags).length"), 0);
});

test("branching at a choice drops the future and its effects", () => {
  const h = harness();
  h.run(`state.beatQueue = prepareBeatQueue({beats:[
    {kind:'pause',prompt:'Choose a path',pauseType:'choice'},
    {kind:'narration',text:'Unchosen future',stateChanges:{flagChanges:[{key:'future',value:'yes'}]}}
  ]}, 'fallback', []); processBeatQueue();`);
  assert.equal(h.run("state.beatQueue.length"), 0);
  assert.equal(h.run("state.worldState.flags.future"), undefined);
});

test("legacy aggregate consequences wait until the end of their timeline", () => {
  const h = harness();
  h.run(`state.beatQueue = prepareBeatQueue({beats:[
    {kind:'narration',text:'Before'}, {kind:'pause',prompt:'Continue',pauseType:'continue'}, {kind:'narration',text:'After'}
  ],stateChanges:{flagChanges:[{key:'legacy',value:'yes'}]}}, 'fallback', []); processBeatQueue();`);
  assert.equal(h.run("state.worldState.flags.legacy"), undefined);
  h.run("state.pendingPause = null; processBeatQueue()");
  assert.equal(h.run("state.worldState.flags.legacy"), "yes");
});

test("cancel restores the action; a late cancelled reply cannot unlock a newer turn", async () => {
  const h = harness();
  h.run("requestLiveTurn = () => new Promise(resolve => { globalThis.turnReply = resolve; }); maybeSummarize = () => {}; state.narrative = [];");
  const old = h.run("handleTurn('old action')");
  const replyOld = h.context.turnReply;
  h.run("cancelTurn()");
  assert.equal(h.element("response-input").value, "old action");
  assert.equal(h.run("state.narrative.length"), 0);
  const current = h.run("handleTurn('new action')");
  const replyCurrent = h.context.turnReply;
  replyOld({result:{narration:"stale"},requestBytes:10});
  await old;
  assert.equal(h.run("turnInFlight"), true);
  assert.equal(h.element("send-button").disabled, true);
  replyCurrent({result:{narration:"current"},requestBytes:10});
  await current;
  assert.equal(h.run("state.narrative.at(-1).text"), "current");
  assert.equal(h.run("turnInFlight"), false);
});

test("cancelled image cannot replace an existing image", async () => {
  const h = harness();
  h.run("state.generatedImage = 'old image'; buildImageReferences = () => []; buildImagePrompt = () => 'prompt';");
  const pending = h.run("requestGeneratedImage()");
  h.run("requestGeneratedImage()");
  h.context.reply({ok:true,json:async()=>({imageDataUrl:'cancelled image'})});
  await pending;
  assert.equal(h.run("state.generatedImage"), "old image");
  assert.equal(h.run("state.imageStatus"), "IMAGE CANCELLED");
});

test("reactions expire in context but development and historical evidence are retained", () => {
  const h = harness();
  h.run(`state.turn=10; state.worldState.memories = [
    {kind:'reaction',text:'Annoyed',expiresTurn:9},
    {kind:'development',text:'More trusting',expiresTurn:0,reason:'Several acts of support'}
  ];`);
  assert.equal(h.run("publicWorldState().memories.length"), 1);
  assert.equal(h.run("publicWorldState().memories[0].text"), "More trusting");
  assert.equal(h.run("state.worldState.memories.length"), 2);
});

test("development proposals never automatically rewrite characters or enter accepted memory", () => {
  const h = harness();
  const original = h.run("state.party[0].personality");
  h.run(`applyStateChanges({stateChanges:{memoryCandidates:[{kind:'development',subjectId:state.party[0].id,text:'Becomes bolder',reason:'Two difficult choices'}]}})`);
  assert.equal(h.run("state.party[0].personality"), original);
  assert.equal(h.run("state.worldState.memories.length"), 0);
  assert.equal(h.run("state.memoryCandidates[0].kind"), "development");
});

test("manual inventory correction is bounded, audited, and reversible", () => {
  const h = harness();
  h.run(`worldEditor = {group:'inventory',index:null,epoch:sessionEpoch,entry:{},baseline:JSON.stringify(state.worldState),candidateIndex:null}; closeWorldEditor = () => { worldEditor=null; };`);
  h.element("world-field-name").value = "Lantern";
  h.element("world-field-quantity").value = "2";
  h.element("world-field-holderId").value = "";
  h.element("world-field-note").value = "Corrected by player";
  h.run("commitWorldEdit()");
  assert.equal(h.run("state.worldState.inventory[0].quantity"), 2);
  assert.match(h.run("state.worldState.corrections[0].text"), /Lantern/);
  h.run("undoWorldEdit()");
  assert.equal(h.run("state.worldState.inventory.length"), 0);
});

test("stale manual edits cannot overwrite later mechanical state", () => {
  const h = harness();
  h.run(`worldEditor = {group:'inventory',index:null,epoch:sessionEpoch,entry:{},baseline:JSON.stringify(state.worldState),candidateIndex:null}; state.worldState.flags.newFact='changed'; commitWorldEdit();`);
  assert.match(h.element("world-editor-status").textContent, /scene changed/);
  assert.equal(h.run("state.worldState.flags.newFact"), "changed");
});

test("packed histories round-trip with shared text, pauses, drafts, and old saves", () => {
  const storage = require("./harness-storage.js");
  const line = {kind:"body",text:"Prose ".repeat(500)};
  const snapshot = {format:"party-harness-session",version:4,narrative:[line],archive:[line],actionDraft:"Next action",narrativeEdit:{lineId:"a",text:"Editing"},beatQueue:[{kind:"narration",text:"Later",stateChanges:{flagChanges:[{key:"later",value:"yes"}]}}],turnCheckpoints:Array.from({length:12},()=>({narrative:[line],archive:[line]}))};
  const packed = storage.pack(snapshot);
  assert.equal(packed.transcriptPool.length, 1);
  assert.deepEqual(storage.unpack(packed), snapshot);
  assert.deepEqual(storage.unpack(storage.pack(packed)), snapshot);
  assert.ok(JSON.stringify(packed).length < JSON.stringify(snapshot).length / 4);
  const legacy = {...snapshot,version:3};
  assert.deepEqual(storage.unpack(legacy), legacy);
  assert.throws(()=>storage.unpack({...packed,narrativeRefs:[999]}), /reference is invalid/);
});

test("server normalizes beat-local changes and does not duplicate aggregate changes", () => {
  const source = fs.readFileSync(path.join(__dirname,"server.js"),"utf8");
  const context = vm.createContext({});
  vm.runInContext(source.slice(source.indexOf("function normalizeTurn("),source.indexOf("function buildInstructions(")),context);
  const normalized = vm.runInContext(`normalizeTurn({narration:'Scene',bubbles:[{characterId:'a',kind:'thought',type:'concern',text:'Something is wrong.'}],beats:[{kind:'narration',text:'Scene',stateChanges:{statDeltas:[{characterId:'a',stat:'resolve',delta:99}],memoryCandidates:[{kind:'reaction',text:'Surprised',subjectId:'a'}]}}],stateChanges:{flagChanges:[{key:'duplicate',value:'bad'}]}},[{id:'a',name:'A'}])`,context);
  assert.equal(normalized.beats[0].stateChanges.statDeltas[0].delta, 25);
  assert.equal(normalized.beats[0].stateChanges.memoryCandidates[0].kind, "reaction");
  assert.equal(normalized.bubbles[0].kind, "thought");
  assert.equal(normalized.stateChanges.flagChanges.length, 0);
});

test("storage failure retains the last durable save and never drops archived prose", async () => {
  const source = fs.readFileSync(path.join(__dirname,"harness-storage.js"),"utf8");
  const values = new Map();
  let fail = false;
  const context = vm.createContext({structuredClone, localStorage:{getItem:key=>values.get(key)||null,removeItem:key=>values.delete(key),setItem:(key,value)=>{if(fail)throw Error("Quota full");values.set(key,value);}}});
  vm.runInContext(source,context);
  await vm.runInContext("HarnessStorage.initialize()",context);
  context.fixture = {format:"party-harness-session",version:4,narrative:[],archive:Array.from({length:3001},(_,i)=>({kind:"body",text:"Historic line " + i})),turnCheckpoints:[]};
  await vm.runInContext("HarnessStorage.put('party-harness-current-state-v1',fixture)",context);
  fail = true;
  await assert.rejects(vm.runInContext("HarnessStorage.put('party-harness-current-state-v1',{...fixture,sessionName:'failed write'})",context), /Quota/);
  assert.equal(vm.runInContext("HarnessStorage.get('party-harness-current-state-v1').archive.length",context),3001);
  assert.equal(vm.runInContext("HarnessStorage.get('party-harness-current-state-v1').sessionName",context),undefined);
  assert.equal(JSON.parse(values.get("party-harness-current-state-v1")).archiveRefs.length,3001);
});

test("every object in the turn schema remains strict and fully required", () => {
  const source = fs.readFileSync(path.join(__dirname,"server.js"),"utf8");
  const context = vm.createContext({});
  vm.runInContext(source.slice(source.indexOf("const turnSchema ="),source.indexOf("const characterProfileSchema =")),context);
  const schema = vm.runInContext("turnSchema",context);
  const visit = node => {
    if (node.type === "object") {
      assert.equal(node.additionalProperties,false);
      assert.deepEqual([...node.required].sort(),Object.keys(node.properties).sort());
      Object.values(node.properties).forEach(visit);
    }
    if (node.items) visit(node.items);
  };
  visit(schema);
  assert.ok(schema.properties.beats.items.required.includes("stateChanges"));
});

test("an outgoing inline editor cannot overwrite an incoming session's draft", () => {
  const h = harness();
  h.element("line-editor-input").dataset = {lineId:"old-line"};
  h.element("line-editor-input").value = "outgoing draft";
  h.run("state.narrative = [{id:'new-line',kind:'body',text:'new prose'}]; state.narrativeEdit = {lineId:'new-line',text:'incoming draft'}; actualRenderNarrative();");
  assert.equal(h.run("state.narrativeEdit.text"), "incoming draft");
  assert.match(h.element("narrative").innerHTML, /incoming draft/);
});


test("optional sound plays once per reveal, stays silent when off, and tolerates playback failure", async () => {
  const h = harness();
  let plays = 0;
  h.context.Audio = class { pause() {} play() { plays++; return Promise.resolve(); } };
  h.run("playPageTurn()");
  assert.equal(plays, 0);
  h.run("soundEnabled = true; state.pendingPause = null; state.beatQueue = [{kind:'narration',text:'First line'}, {kind:'narration',text:'Second line'}]; processBeatQueue()");
  assert.equal(plays, 1);
  h.run("processBeatQueue()");
  assert.equal(plays, 1);
  h.run("soundEnabled = false; playPageTurn(true)");
  assert.equal(plays, 2);
  h.run("soundVolume = 0; playPageTurn(true)");
  assert.equal(plays, 2);
  h.context.Audio = class { pause() {} play() { return Promise.reject(new Error('blocked')); } };
  h.run("pageTurnAudio = null; soundVolume = .35; playPageTurn(true)");
  await Promise.resolve();
  assert.match(h.element('sound-status').textContent, /could not play/);
});


test("tab title tracks overlapping requests and ignores cancelled late replies", async () => {
  const h = harness();
  h.run("requestLiveTurn = () => new Promise(resolve => { globalThis.turnReply = resolve; }); maybeSummarize = () => {}; state.narrative = [];");
  const turn = h.run("handleTurn('look around')");
  const image = h.run("requestGeneratedImage()");
  assert.match(h.context.document.title, /Text loading.*Image loading/);
  h.context.turnReply({result:{narration:'A quiet room.'},requestBytes:10});
  await turn;
  assert.match(h.context.document.title, /Text ready.*Image loading/);
  h.run("document.visibilityState = 'visible'; acknowledgeGenerationTitle()");
  assert.equal(h.context.document.title, 'Image loading… | Party Harness');
  h.run("requestGeneratedImage()");
  assert.match(h.context.document.title, /Image cancelled/);
  h.context.reply({ok:true,json:async()=>({imageDataUrl:'data:image/png;base64,test'})});
  await image;
  assert.match(h.context.document.title, /Image cancelled/);
  h.run("cancelSessionRequests()");
  assert.equal(h.context.document.title, 'Party Harness // Prototype');
});

test("tab title reports failures and keeps completion notices while hidden", async () => {
  const h = harness();
  h.run("requestLiveTurn = async () => { throw Error('offline'); }");
  await h.run("handleTurn('look around')");
  assert.match(h.context.document.title, /Text failed/);
  h.run("document.visibilityState = 'hidden'; acknowledgeGenerationTitle()");
  assert.match(h.context.document.title, /Text failed/);
  h.run("document.visibilityState = 'visible'; acknowledgeGenerationTitle()");
  assert.equal(h.context.document.title, 'Party Harness // Prototype');
});


test("new provider settings travel with text requests and never reuse a foreign text key for images", async () => {
  const h = harness();
  h.run("state.provider='ollama'; state.model='local-model'; state.apiBaseUrl='http://127.0.0.1:11434/v1'; state.structuredOutput='schema'; state.apiKey=''; state.serverKeys={};");
  assert.equal(h.run('hasUsableTextKey()'),true);
  const request=h.run("buildTurnRequest('look around')");
  assert.equal(request.settings.apiBaseUrl,'http://127.0.0.1:11434/v1');
  assert.equal(request.settings.structuredOutput,'schema');
  h.run("state.provider='anthropic'; state.apiKey='foreign-text-key'; state.imageProvider='openai'; state.imageApiKey=''; fetchWithTimeout=async (url,options)=>{globalThis.imageBody=JSON.parse(options.body); return {ok:true,json:async()=>({imageDataUrl:'data:image/png;base64,test'})};};");
  await h.run('requestGeneratedImage()');
  assert.equal(h.context.imageBody.apiKey,'');
  h.run("state.imageApiKey='explicit-image-key'");
  await h.run('requestGeneratedImage()');
  assert.equal(h.context.imageBody.apiKey,'explicit-image-key');
});

test("speech bubbles render in the outside overlay and remain dismissible", () => {
  const h = harness();
  h.run(`
    const layer = document.getElementById('sidebar-bubble-layer');
    const panel = document.getElementById('sidebar-panel-party');
    const member = state.party[0];
    const card = {dataset:{memberId:member.id}, getBoundingClientRect:() => ({top:20,left:380,right:480,bottom:120})};
    const bubble = {dataset:{bubbleAnchor:member.id}, style:{}, offsetWidth:80, hidden:false};
    globalThis.testBubble = bubble;
    layer.getBoundingClientRect = () => ({top:0,left:300});
    panel.getBoundingClientRect = () => ({top:0,left:300,right:600,bottom:500});
    panel.querySelectorAll = () => [card];
    layer.querySelectorAll = selector => selector === '[data-dismiss-bubble]'
      ? [{dataset:{dismissBubble:'0'}, addEventListener:(_, callback) => { globalThis.dismissBubble = callback; }}]
      : [bubble];
    state.bubbles = [{characterId:member.id,type:'warning',text:'Look out'}];
    renderPartyBubbles();
  `);
  assert.equal(h.element("sidebar-bubble-layer").hidden, false);
  assert.equal(h.run("testBubble.style.top"), "20px");
  assert.equal(h.run("testBubble.style.left"), "-12px");
  h.run("dismissBubble({stopPropagation(){}})");
  assert.equal(h.run("state.bubbles.length"), 0);
});

test("additive bubbles stay out of the transcript and thought styling survives", () => {
  const h = harness();
  h.run(`
    state.narrative = [];
    state.beatQueue = prepareBeatQueue({beats:[],stateChanges:{}}, 'The room goes quiet.');
    processBeatQueue([{characterId:state.party[0].id,kind:'thought',type:'concern',text:'This is not a safe silence.'}]);
    const layer = document.getElementById('sidebar-bubble-layer');
    const panel = document.getElementById('sidebar-panel-party');
    layer.getBoundingClientRect = () => ({top:0,left:300});
    panel.getBoundingClientRect = () => ({top:0,left:300,right:600,bottom:500});
    panel.querySelectorAll = () => [];
    layer.querySelectorAll = () => [];
    state.bubbles = [{characterId:state.party[0].id,kind:'thought',type:'concern',text:'This is not a safe silence.'}];
    renderPartyBubbles();
  `);
  assert.equal(h.run("state.narrative.length"), 1);
  assert.equal(h.run("state.narrative[0].kind"), "body");
  assert.equal(h.run("state.bubbles[0].kind"), "thought");
  assert.match(h.element("sidebar-bubble-layer").innerHTML, /member-bubble thought/);
  assert.match(h.element("sidebar-bubble-layer").innerHTML, /data-bubble-kind="thought"/);
});

test("story formatting renders safe Markdown and supports plain text", () => {
  const h = harness();
  h.run("state.textFormatting = 'markdown'");
  const formatted = h.run("formatStoryText('# Scene\\n\\nA **bold** and *quiet* \\u0060signal\\u0060 with <script>alert(1)</script>.\\n- Keep watch')");
  assert.match(formatted, /formatted-heading/);
  assert.match(formatted, /<strong>bold<\/strong>/);
  assert.match(formatted, /<em>quiet<\/em>/);
  assert.match(formatted, /<code>signal<\/code>/);
  assert.match(formatted, /formatted-list/);
  assert.match(formatted, /&lt;script&gt;/);
  assert.doesNotMatch(formatted, /<script>/);
  h.run("state.textFormatting = 'plain'");
  const plain = h.run("formatStoryText('A **bold** line')");
  assert.match(plain, /\\*\\*bold\\*\\*/);
  assert.doesNotMatch(plain, /<strong>/);
});

test("NovelAI wrappers are stripped and prose fallback stays playable", () => {
  const source = fs.readFileSync(path.join(__dirname, "server.js"), "utf8");
  const start = source.indexOf("function parseTurnJson(");
  const end = source.indexOf("function normalizeTurn(", start);
  const context = vm.createContext({});
  vm.runInContext(source.slice(start, end), context);
  assert.equal(vm.runInContext("stripNovelAIReasoning('<think>private</think><|assistant|>{\\\"narration\\\":\\\"Ready\\\"}<|end|>')", context), '{"narration":"Ready"}');
  assert.equal(vm.runInContext("parseNovelAITurn('The model ignored the JSON shell but wrote a usable scene.').narration", context), "The model ignored the JSON shell but wrote a usable scene.");
  assert.throws(() => vm.runInContext("parseNovelAITurn('{broken')", context));
});

test("NovelAI empty choices include the provider's stop diagnostics", () => {
  const source = fs.readFileSync(path.join(__dirname, "server.js"), "utf8");
  const start = source.indexOf("function extractChatText(");
  const end = source.indexOf("function extractNovelAIText(", start);
  const context = vm.createContext({});
  vm.runInContext(source.slice(start, end), context);
  assert.throws(
    () => vm.runInContext("extractChatText({choices:[{index:0,text:'',token_ids:[1,2],finish_reason:'stop',matched_stop:'<|end|>'}]})", context),
    /finish_reason=stop, matched_stop=\"<\|end\|>\", token_ids=2/
  );
});

test("NovelAI recovers visible token text when the completion text field is empty", () => {
  const source = fs.readFileSync(path.join(__dirname, "server.js"), "utf8");
  const start = source.indexOf("function extractChatText(");
  const end = source.indexOf("function extractNovelAIText(", start);
  const context = vm.createContext({});
  vm.runInContext(source.slice(start, end), context);
  assert.equal(
    vm.runInContext("extractChatText({choices:[{text:'',logprobs:{tokens:['{\\\"narration\\\":\\\"Recovered\\\"}']},finish_reason:'stop'}]})", context),
    '{"narration":"Recovered"}'
  );
  assert.equal(
    vm.runInContext("extractChatText({choices:[{text:'',convertedLogprobs:[{chosen:{token:123,str:'{\\\"narration\\\":\\\"Converted\\\"}'}}],finish_reason:'stop'}]})", context),
    '{"narration":"Converted"}'
  );
});

test("NovelAI request compaction preserves the saved source and caps output", () => {
  const source = fs.readFileSync(path.join(__dirname, "server.js"), "utf8");
  const start = source.indexOf("function clampNovelAITokens(");
  const end = source.indexOf("const CHARACTER_PROFILE_INSTRUCTIONS", start);
  const context = vm.createContext({});
  vm.runInContext("const NOVELAI_MAX_OUTPUT_TOKENS=2048; const NOVELAI_CONTEXT_CHAR_LIMIT=90000; const NOVELAI_JSON_GUIDANCE='guide';\n" + source.slice(start, end), context);
  const profile = "profile ".repeat(30000);
  const input = { party: [{ name: "A", characterFileContent: profile }], sessionPrompt: "session ".repeat(5000) };
  const payload = vm.runInContext("buildNovelAIRequest({instructions:'rules', input:" + JSON.stringify(input) + ", settings:{model:'glm-4-6'}, maxTokens:3700, temperature:0.7})", context);
  assert.equal(payload.max_tokens, 2048);
  assert.ok(JSON.stringify(payload).length < 150000);
  assert.equal(input.party[0].characterFileContent.length, profile.length);
});
