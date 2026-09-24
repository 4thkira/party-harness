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
      classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } } });
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
  // The live transcript renders into #narrative-body; #narrative also holds the folded archive,
  // which is rebuilt on its own schedule.
  assert.match(h.element("narrative-body").innerHTML, /incoming draft/);
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

test("a NovelAI chat stream is folded back into the non-streaming shape", () => {
  // NovelAI answers a non-streamed /oa/v1/chat/completions with an empty choices[0].text and no
  // message object, so the chat path streams and reassembles. That empty reply is the whole reason
  // session generation, character import, and every turn came back blank on this provider.
  const source = fs.readFileSync(path.join(__dirname, "server.js"), "utf8");
  const start = source.indexOf("function collapseNovelAIStream(");
  const end = source.indexOf("const novelAITextRequest", start);
  const context = vm.createContext({});
  vm.runInContext(source.slice(start, end), context);
  const sse = [
    'data: {"id":"c1","model":"glm-4-6","choices":[{"index":0,"delta":{"role":"assistant","content":""}}]}',
    '',
    'data: {"choices":[{"index":0,"delta":{"content":"{\\"sessionName\\":"}}]}',
    '',
    'data: {"choices":[{"index":0,"delta":{"content":"\\"Port Veritas\\"}"},"finish_reason":"stop"}],"usage":{"total_tokens":9}}',
    '',
    'data: [DONE]'
  ].join("\n");
  const collapsed = vm.runInContext("collapseNovelAIStream(" + JSON.stringify(sse) + ")", context);
  assert.equal(collapsed.choices[0].message.content, '{"sessionName":"Port Veritas"}');
  assert.equal(collapsed.choices[0].text, '{"sessionName":"Port Veritas"}');
  assert.equal(collapsed.choices[0].finish_reason, "stop");
  assert.equal(collapsed.usage.total_tokens, 9);
  assert.equal(collapsed.id, "c1");
  // An ordinary JSON body -- an upstream error, or a non-streamed reply -- passes through untouched.
  assert.equal(vm.runInContext('collapseNovelAIStream(JSON.stringify({statusCode:400,message:"bad request"}))', context), null);
});

test("the NovelAI structured prompts name every required key", () => {
  // This endpoint enforces no response_format, so the key names have to travel in the prompt.
  // Without them the model invents its own and every normalized field falls back to a default.
  const source = fs.readFileSync(path.join(__dirname, "server.js"), "utf8");
  const shape = source.slice(source.indexOf("function buildNovelAIRequest("), source.indexOf("const CHARACTER_PROFILE_INSTRUCTIONS"));
  const schemas = source.slice(source.indexOf("const characterProfileSchema"), source.indexOf("// The bubble frequency setting owns"));
  for (const match of schemas.matchAll(/required: \[([^\]]+)\]/g)) {
    for (const key of match[1].match(/"[a-zA-Z]+"/g) || []) {
      assert.ok(shape.includes(key.slice(1, -1)), "the NovelAI prompt shape omits the required key " + key);
    }
  }
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

test("an unmappable check stat is rolled as a substitution and disclosed, not hidden", () => {
  const h = harness();
  h.run(`
    state.statDefinitions = [
      {id:'grit',label:'GRT',name:'Grit',description:'force'},
      {id:'wits',label:'WIT',name:'Wits',description:'thought'},
      {id:'luck',label:'LCK',name:'Luck',description:'chance'}
    ];
    state.party = [{id:'ash',name:'Ash',stats:[60,50,50],feeling:'',muted:false,initiative:true}];
    state.selected = 0;
    state.narrative = [];
    // What the server hands over when the model asked for a stat this session does not define.
    state.pendingPause = {pauseType:'check',characterId:'ash',checkStat:'',checkStatRequested:'strength',
      checkLabel:'Force the door',difficulty:50,choices:[],checkSeed:12345};
    resolvePendingCheck();
  `);
  // resolvePendingCheck appends the check line, then hands the result straight to the next turn,
  // which appends the action as a choice line -- so select by kind rather than by position.
  const line = h.run("state.narrative.find(entry => entry.kind === 'check')");
  assert.ok(line, "no check line was recorded");
  // Rolled against the first stat, and says so, naming what was actually requested.
  assert.equal(line.stat, "GRT");
  assert.match(line.text, /The scene asked for "strength", which this session does not define, so GRT was rolled instead./);
  assert.equal(h.run("state.worldState.recentChecks.at(-1).substitutedStat"), "strength");
  // The model is told too, so it stops asking for a stat that does not exist.
  const sent = h.run("state.narrative.filter(entry => entry.kind === 'choice').at(-1).text");
  assert.match(sent, /The requested check stat "strength" is not defined in this session; Grit was used/);
});

test("a resolved check keeps its stat when the session defines it", () => {
  const h = harness();
  h.run(`
    state.statDefinitions = [
      {id:'grit',label:'GRT',name:'Grit',description:'force'},
      {id:'wits',label:'WIT',name:'Wits',description:'thought'},
      {id:'luck',label:'LCK',name:'Luck',description:'chance'}
    ];
    state.party = [{id:'ash',name:'Ash',stats:[60,50,50],feeling:'',muted:false,initiative:true}];
    state.narrative = [];
    state.pendingPause = {pauseType:'check',characterId:'ash',checkStat:'wits',checkStatRequested:'',
      checkLabel:'Read the room',difficulty:50,choices:[],checkSeed:12345};
    resolvePendingCheck();
  `);
  const line = h.run("state.narrative.find(entry => entry.kind === 'check')");
  assert.ok(line, "no check line was recorded");
  assert.equal(line.stat, "WIT");
  assert.doesNotMatch(line.text, /does not define/);
  assert.equal(h.run("state.worldState.recentChecks.at(-1).substitutedStat"), "");
});

test("a check rolls the same number after an undo instead of quietly rerolling", () => {
  const h = harness();
  h.run(`
    state.statDefinitions = [
      {id:'grit',label:'GRT',name:'Grit',description:'force'},
      {id:'wits',label:'WIT',name:'Wits',description:'thought'},
      {id:'luck',label:'LCK',name:'Luck',description:'chance'}
    ];
    state.party = [{id:'ash',name:'Ash',stats:[60,50,50],feeling:'',muted:false,initiative:true}];
    state.narrative = []; state.turnCheckpoints = [];
    state.beatQueue = [{kind:'check',text:'',prompt:'Force the door',checkStat:'grit',difficulty:50,characterId:'ash'}];
    processBeatQueue();
  `);
  // The seed is drawn when the check becomes pending, not when the player clicks ROLL.
  const seed = h.run("state.pendingPause.checkSeed");
  assert.ok(seed > 0, "a pending check was left without a seed");

  h.run("globalThis.checkpoint = captureTurnCheckpoint('force the door'); resolvePendingCheck();");
  const first = h.run("state.worldState.recentChecks.at(-1)");

  // Undo back to the pause and roll it again.
  h.run("turnInFlight = false; restoreTurnCheckpoint(checkpoint);");
  assert.equal(h.run("state.pendingPause.checkSeed"), seed, "the seed did not survive the checkpoint");
  h.run("resolvePendingCheck();");
  const second = h.run("state.worldState.recentChecks.at(-1)");
  assert.equal(second.roll, first.roll);
  assert.equal(second.success, first.success);

  // Sanity: a different seed is a different roll, so the above is reproducibility, not a constant.
  const rolls = new Set(h.run("[1,2,3,4,5,6,7,8].map(seededRoll)"));
  assert.ok(rolls.size > 4, "seededRoll is not varying across seeds");
  assert.ok([...rolls].every(value => value >= 1 && value <= 100));
});

test("the folded archive re-renders only when what it displays changes", () => {
  const h = harness();
  const archive = h.element("narrative-archive");
  let writes = 0;
  let html = "";
  Object.defineProperty(archive, "innerHTML", { get: () => html, set: value => { writes += 1; html = value; } });

  h.run("state.archive = Array.from({length: 200}, (_, i) => ({kind:'body', text:'folded ' + i})); state.archiveOpen = true; actualRenderNarrative();");
  assert.equal(writes, 1);
  assert.match(html, /folded 199/);

  // renderAll() fires on every beat reveal and settings change. None of these touch the archive.
  h.run("state.storySummary = 'a summary'; actualRenderNarrative(); actualRenderNarrative(); actualRenderNarrative();");
  assert.equal(writes, 1, "the archive re-rendered for a change that does not affect it");

  // Collapsing it does.
  h.run("state.archiveOpen = false; actualRenderNarrative();");
  assert.equal(writes, 2);
  assert.doesNotMatch(html, /folded 199/);

  // So does folding more prose into it, and so does a formatting change.
  h.run("state.archiveOpen = true; state.archive.push({kind:'body', text:'folded 200'}); actualRenderNarrative();");
  assert.equal(writes, 3);
  assert.match(html, /folded 200/);
  h.run("state.textFormatting = 'plain'; actualRenderNarrative();");
  assert.equal(writes, 4);
});

test("column proportions reject broken saved values and retain valid priorities", () => {
  const h = harness();
  const fallback = h.run("normalizeColumnRatios(null)");
  assert.equal(fallback.length, 3);
  assert.ok(Math.abs(fallback.reduce((sum, value) => sum + value, 0) - 1) < 0.000001);
  assert.deepEqual(h.run("normalizeColumnRatios([0, 1, 1])"), fallback);
  assert.deepEqual(h.run("normalizeColumnRatios([0.02, 0.49, 0.49])"), fallback);
  const custom = h.run("normalizeColumnRatios([3, 5, 2])");
  assert.ok(Math.abs(custom[0] - .3) < 0.000001);
  assert.ok(Math.abs(custom[1] - .5) < 0.000001);
  assert.ok(Math.abs(custom[2] - .2) < 0.000001);
});

test("cancelling party banter leaves the action box, transcript, and undo history alone", async () => {
  const h = harness();
  h.run("requestLiveTurn = () => new Promise(resolve => { globalThis.turnReply = resolve; }); state.narrative = [{kind:'body',text:'Before'}]; state.turnCheckpoints = [captureTurnCheckpoint('earlier turn')];");
  const pending = h.run("handleBanter()");
  h.run("cancelTurn()");
  // Banter is not a typed action, so there is nothing to put back; "Party banter" in the box would
  // be sent to the engine as a real action by the next Enter.
  assert.equal(h.element("response-input").value, "");
  assert.equal(h.run("turnInFlight"), false);
  assert.equal(h.run("state.turnCheckpoints.length"), 1);
  h.context.turnReply({result:{narration:"late",beats:[{kind:"dialogue",characterId:"spierce",text:"Too late."}]},requestBytes:10});
  await pending;
  assert.equal(h.run("state.narrative.length"), 1);
});

test("a failed LLM pass on a folder profile is reported instead of leaving the sheet waiting", async () => {
  const h = harness();
  h.run(`editingIndex = 0; modalMode = 'edit';
    fetchWithTimeout = async url => url.startsWith('/api/character-files/')
      ? { ok: true, status: 200, json: async () => ({ name: 'characters/ellis.md', content: '# Ellis' }) }
      : { ok: false, status: 401, json: async () => ({ error: 'Incorrect API key provided.' }) };`);
  await h.run("loadCharacterFile('characters/ellis.md')");
  assert.match(h.element("character-file-status").textContent, /not updated: Incorrect API key provided/);
  assert.equal(h.run("pendingCharacterFileContent"), "# Ellis");
  assert.equal(h.run("characterFileLoading"), false);
  assert.equal(h.element("save-member").disabled, false);
});

test("a proposal for a full world-state list is refused visibly, and existing entries still update", () => {
  const h = harness();
  h.run(`state.worldState.objectives = Array.from({length: WORLD_LIMITS.objectives}, (_, i) => ({objectiveId:'old-' + i,label:'Old ' + i,status:'completed',ownerId:'',progress:100,reason:''}));
    state.worldState.flags = Object.fromEntries(Array.from({length: WORLD_LIMITS.flags}, (_, i) => ['fact-' + i, 'yes']));`);
  const report = h.run(`applyStateChanges({stateChanges:{
    objectiveChanges:[{objectiveId:'new-quest',label:'Find the keeper',status:'active',progress:0},{objectiveId:'old-3',label:'Old 3',status:'failed',progress:100}],
    flagChanges:[{key:'new-fact',value:'yes'},{key:'fact-2',value:'changed'}]}})`);
  // normalizeWorldState keeps the first entries of a full list, so these used to be reported as
  // applied and then silently cut.
  assert.equal(h.run("state.worldState.objectives.some(entry => entry.objectiveId === 'new-quest')"), false);
  assert.equal(h.run("'new-fact' in state.worldState.flags"), false);
  assert.ok(report.applied.every(entry => !/Find the keeper|new-fact/.test(entry)));
  assert.match(report.rejected.join("; "), /objectives list is full \(30\); Find the keeper was not added/);
  assert.match(report.rejected.join("; "), /world facts list is full \(80\); new-fact was not added/);
  assert.equal(h.run("state.worldState.objectives.find(entry => entry.objectiveId === 'old-3').status"), "failed");
  assert.equal(h.run("state.worldState.flags['fact-2']"), "changed");
});

test("a stat label with a digit is not read as a stat value", () => {
  const h = harness();
  // + ADD STAT labels a new stat S4 and focuses its name, so the label is easy to leave as it is.
  h.run("state.statDefinitions = normalizeStatDefinitions([...DEFAULT_STAT_DEFINITIONS, {id:'stat-4',label:'S4',name:'Charm',description:'Winning people over.'}]);");
  const field = h.run("formatStatsForInput([72, 84, 45, 50])");
  assert.equal(field, "RES 72 / INS 84 / FOR 45 / S4 50");
  assert.deepEqual(Array.from(h.run("parseStats(" + JSON.stringify(field) + ")")), [72, 84, 45, 50]);
  // Hand-typed shapes that already parsed keep parsing.
  assert.deepEqual(Array.from(h.run("parseStats('70 60 50 40')")), [70, 60, 50, 40]);
  assert.deepEqual(Array.from(h.run("parseStats('res70 / ins60 / for50 / s4 40')")), [70, 60, 50, 40]);
});

test("an untouched character sheet is not unsaved work, new or existing", () => {
  const h = harness();
  for (const id of h.run("MODAL_IDS")) h.element(id).classList.contains = () => false;
  // A new sheet opens with a default feeling and colour; compared against empty fields, that alone
  // made Escape ask to discard a sheet nobody had touched.
  h.run("openModal(null)");
  assert.equal(h.run("characterFormDirty()"), false);
  h.element("character-name").value = "Wren";
  assert.equal(h.run("characterFormDirty()"), true);
  h.run("state.statDefinitions = normalizeStatDefinitions([...DEFAULT_STAT_DEFINITIONS, {id:'stat-4',label:'S4',name:'Charm',description:'x'}]); state.party[0].stats = [72, 84, 45, 50]; openModal(0);");
  assert.equal(h.run("characterFormDirty()"), false);
});

test("a stat delta on a missing value starts from the 50 every other view shows", () => {
  const h = harness();
  h.run("state.party[0].stats = [60, 70];");
  h.run("applyStateChanges({stateChanges:{statDeltas:[{characterId:state.party[0].id,stat:'fortune',delta:5,reason:'lucky break'}]}})");
  assert.equal(h.run("state.party[0].stats[2]"), 55);
});

test("a check result is not recalled by ArrowUp as if the player had typed it", async () => {
  const h = harness();
  h.run(`requestLiveTurn = () => new Promise(resolve => { globalThis.turnReply = resolve; }); maybeSummarize = () => {}; showDiceResult = () => {};
    state.narrative = []; state.actionHistory = ['Force the door'];
    state.pendingPause = {pauseType:'check',characterId:state.party[0].id,checkStat:'resolve',checkStatRequested:'',checkLabel:'Force the door',difficulty:50,choices:[],checkSeed:12345};`);
  const pending = h.run("resolvePendingCheck()");
  assert.equal(h.run("state.actionHistory[0]"), "Force the door");
  // The engine still receives it, as the latest action in the transcript.
  assert.match(h.run("state.narrative.at(-1).text"), /^CHECK RESULT — /);
  h.context.turnReply({result:{narration:"The door gives way."},requestBytes:10});
  await pending;
});

test("local media answers a suffix range with the final bytes, and an empty file still answers", () => {
  const server = fs.readFileSync(path.join(__dirname, "server.js"), "utf8");
  const streams = [];
  const context = vm.createContext({ path, __dirname: path.resolve("fixture-root"), writeJson() {}, fs: {
    statSync: file => ({ isFile: () => true, isDirectory: () => true, size: file.endsWith("empty.css") ? 0 : 1000 }),
    realpathSync: file => file,
    // Node refuses end -1 the same way, synchronously.
    createReadStream: (file, options) => {
      if (options.end < 0) throw new RangeError('The value of "end" is out of range.');
      streams.push(options);
      return { on() { return this; }, pipe() {} };
    }
  }});
  vm.runInContext(server.slice(server.indexOf("const CHARACTER_DIR ="), server.indexOf("function characterFileNameFromUrl(")), context);
  const answer = (kind, name, headers = {}) => {
    const res = { status: 0, headers: null, ended: false, writeHead(status, sent) { this.status = status; this.headers = sent; }, end() { this.ended = true; } };
    vm.runInContext("serveLocalLibraryFile", context)({ headers }, res, kind, name);
    return res;
  };
  // "-100" is the LAST 100 bytes. It was read as "0-100": the wrong bytes, and 101 of them.
  const suffix = answer("music", "theme.mp3", { range: "bytes=-100" });
  assert.equal(suffix.status, 206);
  assert.equal(suffix.headers["Content-Range"], "bytes 900-999/1000");
  assert.equal(suffix.headers["Content-Length"], 100);
  assert.deepEqual({ ...streams.at(-1) }, { start: 900, end: 999 });
  assert.equal(answer("music", "theme.mp3", { range: "bytes=990-" }).headers["Content-Range"], "bytes 990-999/1000");
  assert.equal(answer("music", "theme.mp3", { range: "bytes=-0" }).status, 416);
  assert.equal(answer("music", "theme.mp3", { range: "bytes=1000-" }).status, 416);
  assert.equal(answer("music", "theme.mp3").status, 200);
  // A skin created but not yet written used to throw after the headers went out and hang.
  const empty = answer("skins", "empty.css");
  assert.equal(empty.status, 200);
  assert.equal(empty.headers["Content-Length"], 0);
  assert.equal(empty.ended, true);
});

test("a NovelAI image ZIP is read through its end record, not the first signature-shaped bytes", () => {
  const zlib = require("node:zlib");
  const source = fs.readFileSync(path.join(__dirname, "server.js"), "utf8");
  const context = vm.createContext({ Buffer, zlib, MAX_DECOMPRESSED_IMAGE_BYTES: 16 * 1024 * 1024 });
  vm.runInContext(source.slice(source.indexOf("function extractNovelAIZipImage("), source.indexOf("function extractOutputText(")), context);
  const extract = vm.runInContext("extractNovelAIZipImage", context);
  const archive = (stored, method, size) => {
    const name = Buffer.from("image_0.png");
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(method, 8); local.writeUInt32LE(stored.length, 18); local.writeUInt32LE(size, 22); local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(method, 10); central.writeUInt32LE(stored.length, 20); central.writeUInt32LE(size, 24); central.writeUInt16LE(name.length, 28);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10); end.writeUInt32LE(central.length + name.length, 12); end.writeUInt32LE(local.length + name.length + stored.length, 16);
    return Buffer.concat([local, name, stored, central, name, end]);
  };
  // Image bytes can contain anything, including the central-directory signature PK\x01\x02.
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("pixels PK\x01\x02 more pixels", "latin1")]);
  assert.ok(extract(archive(png, 0, png.length))?.equals(png), "a stored image with a stray signature was rejected");
  assert.ok(extract(archive(zlib.deflateRawSync(png), 8, png.length))?.equals(png), "a deflated image was rejected");
});

test("request bodies are measured as they arrive, and the size limit still holds", async () => {
  const { PassThrough } = require("node:stream");
  const source = fs.readFileSync(path.join(__dirname, "server.js"), "utf8");
  const context = vm.createContext({ Buffer });
  vm.runInContext(source.slice(source.indexOf("function bodyTooLargeError("), source.indexOf("// Every provider call shares one implementation.")), context);
  const readBody = vm.runInContext("readBody", context);
  const send = (chunks, limit) => {
    const req = new PassThrough();
    req.headers = {};
    const pending = readBody(req, limit);
    for (const chunk of chunks) req.write(chunk);
    req.end();
    return pending;
  };
  // A character split across two writes is decoded, and counted, once.
  const euro = Buffer.from("€");
  assert.equal(await send([euro.subarray(0, 1), euro.subarray(1)], 3), "€");
  await assert.rejects(send([euro, "x"], 3), error => error.statusCode === 413);
  // Re-measuring the whole body on every chunk was quadratic: this took several seconds, and an
  // image request with reference images blocked the server for about two. The bound is generous.
  const started = Date.now();
  const body = await send(Array.from({ length: 2048 }, () => "x".repeat(4096)), 16 * 1024 * 1024);
  assert.equal(body.length, 8 * 1024 * 1024);
  assert.ok(Date.now() - started < 2000, "reading an 8 MiB body took " + (Date.now() - started) + " ms");
});

test("malformed JSON is reported as the model's output rather than a bare parser error", () => {
  const source = fs.readFileSync(path.join(__dirname, "server.js"), "utf8");
  const context = vm.createContext({});
  vm.runInContext(source.slice(source.indexOf("function parseTurnJson("), source.indexOf("function stripNovelAIReasoning(")), context);
  assert.throws(() => vm.runInContext(`parseTurnJson('Here you go: {"narration": "The door opens" "bubbles": []}')`, context),
    /^Error: The model returned malformed roleplay JSON: Expected .+ in JSON at position \d+/);
  assert.equal(vm.runInContext(`parseTurnJson('Sure! {"narration": "The door opens"} Enjoy.').narration`, context), "The door opens");
});

test(".env values drop a note after a space and #, but keep a quoted or attached #", () => {
  const source = fs.readFileSync(path.join(__dirname, "server.js"), "utf8");
  const env = { OPENAI_MODEL: "from-the-environment" };
  const context = vm.createContext({ path, __dirname: path.resolve("fixture-root"), process: { env }, fs: { readFileSync: () => [
    "# a whole-line comment",
    "OPENAI_API_KEY=sk-test-123 # my main key",
    'NOVELAI_API_KEY="pst-abc # inside quotes" # outside them',
    "COMPATIBLE_API_KEY=abc#def",
    "GROQ_API_KEY= # fill in later",
    "export RP_PORT='9123'",
    "OPENAI_MODEL=from-the-file",
    "OPENAI_API_KEY=second-entry-loses"
  ].join("\r\n") } });
  vm.runInContext(source.slice(source.indexOf("function envValue("), source.indexOf("const ENV_FILE_STATUS = loadEnvFile();")), context);
  const status = vm.runInContext("loadEnvFile()", context);
  // A note beside a key used to be sent to the provider as part of the key.
  assert.equal(env.OPENAI_API_KEY, "sk-test-123");
  assert.equal(env.NOVELAI_API_KEY, "pst-abc # inside quotes");
  assert.equal(env.COMPATIBLE_API_KEY, "abc#def");
  assert.equal(env.GROQ_API_KEY, undefined);
  assert.equal(env.RP_PORT, "9123");
  assert.equal(env.OPENAI_MODEL, "from-the-environment");
  assert.deepEqual(Array.from(status.activeNames).sort(), ["COMPATIBLE_API_KEY", "NOVELAI_API_KEY", "OPENAI_API_KEY", "OPENAI_MODEL", "RP_PORT"]);
  assert.deepEqual(Array.from(status.malformedLines), []);
});

function connectionIndicator(h) {
  const classes = new Set();
  const indicator = h.element("connection-indicator");
  indicator.classList = { toggle: (name, on) => { if (on) classes.add(name); else classes.delete(name); }, add() {}, remove() {} };
  indicator.setAttribute = () => {};
  h.context.document.querySelector = () => indicator;
  return classes;
}

test("CHECK CONNECTION fills the model list, and its green dot does not outlive the key it checked", async () => {
  const h = harness();
  const classes = connectionIndicator(h);
  h.run(`state.provider = 'openrouter'; state.apiKey = 'sk-or-fixture'; state.model = 'vendor/gone'; state.endpoint = '';
    fetchWithTimeout = async url => url === '/api/health'
      ? { ok: true, status: 200, json: async () => ({ ok: true, serverKeys: {} }) }
      : { ok: true, status: 200, json: async () => ({ ok: true, provider: 'openrouter', hidden: 2, freeTier: true, keySource: 'browser',
          models: [{ id: 'vendor/model:free', name: 'Model', free: true }, { id: 'vendor/paid', name: 'Paid', free: false }] }) };`);
  await h.run("checkProviderConnection()");
  assert.match(h.element("model-options").innerHTML, /<option value="vendor\/model:free">\(free\) Model<\/option>/);
  const status = h.element("provider-check-status").textContent;
  assert.match(status, /^OpenRouter accepted the key and lists 2 models\./);
  assert.match(status, /1 of them are free and marked \(free\)\./);
  assert.match(status, /free tier/);
  assert.match(status, /The current model “vendor\/gone” is not in that list/);
  assert.equal(classes.has("verified"), true);
  h.run("state.apiKey = 'a-different-key'; connectionChanged(); refreshConnectionLabel();");
  assert.equal(classes.has("verified"), false);
  // Another provider's IDs are not offered as suggestions.
  h.run("state.provider = 'groq'; renderModelOptions();");
  assert.equal(h.element("model-options").innerHTML, "");
});

test("CHECK CONNECTION explains a missing key, a stopped harness, and ignores answers about old settings", async () => {
  const h = harness();
  connectionIndicator(h);
  h.run(`state.provider = 'anthropic'; state.apiKey = ''; state.endpoint = '';
    fetchWithTimeout = async () => ({ ok: true, status: 200, json: async () => ({ ok: true, serverKeys: { openai: true }, envFilePresent: true, envFileActiveSettings: ['OPENAI_API_KEY'] }) });`);
  await h.run("checkProviderConnection()");
  assert.match(h.element("provider-check-status").textContent, /its \.env key is for OpenAI, not Anthropic/);
  h.run("fetchWithTimeout = async () => { throw new Error('The health check could not connect.'); };");
  await h.run("checkProviderConnection()");
  assert.match(h.element("provider-check-status").textContent, /^The harness server did not answer/);
  // The player switches providers while the list is on its way: that list is about the old one.
  h.run(`state.provider = 'ollama'; state.model = '';
    fetchWithTimeout = async url => url === '/api/health'
      ? { ok: true, status: 200, json: async () => ({ ok: true, serverKeys: {} }) }
      : new Promise(resolve => { globalThis.listReply = resolve; });`);
  const pending = h.run("checkProviderConnection()");
  await new Promise(resolve => setImmediate(resolve));
  h.run("state.provider = 'lmstudio'; connectionChanged();");
  h.context.listReply({ ok: true, status: 200, json: async () => ({ ok: true, models: [{ id: 'only-model' }] }) });
  await pending;
  assert.equal(h.run("state.model"), "");
  assert.ok(!h.element("model-options").innerHTML, "a list about the old provider was offered");
});

test("saving a key edits one .env line and leaves the rest of the file as the player wrote it", () => {
  const source = fs.readFileSync(path.join(__dirname, "server.js"), "utf8");
  const context = vm.createContext({});
  vm.runInContext(source.slice(source.indexOf("function upsertEnvText("), source.indexOf("// What a new .env starts from")), context);
  const upsert = (raw, name, value) => vm.runInContext("upsertEnvText(" + JSON.stringify(raw) + ", " + JSON.stringify(name) + ", " + JSON.stringify(value) + ")", context);
  // The template's commented line is taken over, in place, with every comment around it kept.
  const example = fs.readFileSync(path.join(__dirname, ".env.example"), "utf8");
  const fromTemplate = upsert(example, "OPENAI_API_KEY", "sk-new");
  assert.match(fromTemplate, /^OPENAI_API_KEY=sk-new$/m);
  assert.doesNotMatch(fromTemplate, /^# OPENAI_API_KEY=/m);
  assert.equal(fromTemplate.split("\n").length, example.trimEnd().split("\n").length + 1);
  assert.match(fromTemplate, /# NOVELAI_API_KEY=pst-\.\.\./);
  // Windows line endings and a byte-order mark survive; a later duplicate cannot take over later.
  const windows = "﻿# mine\r\nOPENAI_API_KEY=old\r\nOPENAI_MODEL=m\r\nOPENAI_API_KEY=duplicate\r\n";
  assert.equal(upsert(windows, "OPENAI_API_KEY", "sk-new"), "﻿# mine\r\nOPENAI_API_KEY=sk-new\r\nOPENAI_MODEL=m\r\n");
  assert.equal(upsert(windows, "OPENAI_API_KEY", ""), "﻿# mine\r\nOPENAI_MODEL=m\r\n");
  // Appended when there is no line to reuse; quoted when a leading # would read as a comment.
  assert.equal(upsert("A=1", "GROQ_API_KEY", "#hash"), 'A=1\nGROQ_API_KEY="#hash"\n');
  assert.equal(upsert("", "GROQ_API_KEY", "gsk"), "GROQ_API_KEY=gsk\n");
  // Whatever is written reads back as exactly the value that was saved.
  vm.runInContext(source.slice(source.indexOf("function envValue("), source.indexOf("// Names that had a value in the real environment")), context);
  assert.equal(vm.runInContext("envValue(" + JSON.stringify("\"#hash\"") + ")", context), "#hash");
});

test("SAVE KEY hands the key to the server, clears the browser copy, and FORGET needs a saved key", async () => {
  const h = harness();
  const calls = [];
  h.context.window.confirm = () => true;
  h.run(`state.provider = 'openai'; state.apiKey = 'sk-typed';
    state.envKeyNames = { text: { openai: 'OPENAI_API_KEY' }, image: { stability: 'STABILITY_API_KEY' } };
    state.serverEnvActiveSettings = [];`);
  h.context.recordCall = (url, body) => calls.push([url, body ? JSON.parse(body) : null]);
  h.run(`fetchWithTimeout = async (url, options) => {
    recordCall(url, options && options.body);
    return url === '/api/health'
      ? { ok: true, status: 200, json: async () => ({ ok: true, serverKeys: { openai: true }, envFileActiveSettings: ['OPENAI_API_KEY'], envKeyNames: { text: { openai: 'OPENAI_API_KEY' }, image: {} } }) }
      : { ok: true, status: 200, json: async () => ({ ok: true, name: 'OPENAI_API_KEY', saved: true, shadowed: false, copiedFrom: '.env.txt' }) };
  };`);
  h.run("renderKeyActions()");
  assert.equal(h.element("save-text-key").disabled, false);
  assert.equal(h.element("forget-text-key").disabled, true);
  await h.run("saveKeyToEnv('text')");
  assert.deepEqual(calls[0], ["/api/env-key", { kind: "text", provider: "openai", value: "sk-typed" }]);
  assert.equal(h.run("state.apiKey"), "");
  assert.equal(h.run("state.serverKeys.openai"), true);
  assert.match(h.element("text-key-status").textContent, /^Saved to \.env as OPENAI_API_KEY\. .*copied into \.env too; you can delete \.env\.txt\.$/);
  h.run("renderKeyActions()");
  assert.equal(h.element("save-text-key").disabled, true, "nothing is typed any more");
  assert.equal(h.element("forget-text-key").disabled, false);
  // Ollama takes no key from .env, so neither button is offered.
  h.run("state.provider = 'ollama'; state.apiKey = 'anything'; renderKeyActions();");
  assert.equal(h.element("save-text-key").disabled, true);
  assert.equal(h.element("forget-text-key").disabled, true);
});

function fileSaveFixture(h, files = {}) {
  // An in-memory stand-in for /api/saves: what the browser sends is exactly what it gets back.
  h.context.requests = [];
  h.context.files = files;
  h.run(`writeStoredSessions = async sessions => { globalThis.library = sessions; return true; };
    readStoredSessions = () => (globalThis.library || []).slice();
    window.confirm = () => true;
    fetchWithTimeout = async (url, options = {}) => {
      requests.push([options.method || 'GET', url]);
      const id = url.split('/')[3];
      const reply = (status, body) => ({ ok: status < 300, status, json: async () => JSON.parse(JSON.stringify(body)) });
      if (!id) return reply(200, { saves: Object.entries(files).map(([name, file]) => ({ id: name, sessionName: file.snapshot.sessionName, savedAt: file.snapshot.savedAt })) });
      if (options.method === 'PUT') { files[id] = { trusted: true, snapshot: JSON.parse(options.body) }; return reply(200, { ok: true }); }
      if (options.method === 'DELETE') { delete files[id]; return reply(200, { ok: true }); }
      return files[id] ? reply(200, files[id]) : reply(404, { error: 'No such save.' });
    };`);
}

test("a library save is also kept as a file, and the file copy is removed with it", async () => {
  const h = harness();
  fileSaveFixture(h);
  h.run("state.sessionId = ''; state.sessionName = 'Kept as a file';");
  await h.run("saveCurrentSession()");
  const id = h.run("state.sessionId");
  assert.match(id, /^session-[a-z0-9]+$/);
  assert.equal(h.context.files[id].snapshot.sessionName, "Kept as a file");
  assert.equal(h.context.files[id].snapshot.format, "party-harness-session");
  assert.match(h.element("sessions-status").textContent, new RegExp("in this browser and as saves/" + id + "\\.json\\.$"));
  h.element("saved-session-select").value = id;
  await h.run("deleteSelectedSession()");
  assert.equal(h.context.files[id], undefined);
  assert.equal(h.run("readStoredSessions().length"), 0);
});

test("a save that exists only as a file is listed and loads by its signature's trust", async () => {
  const h = harness();
  const foreign = { format: "party-harness-session", version: 4, id: "from-a-friend", savedAt: "2026-09-01T00:00:00Z", sessionName: "Borrowed story",
    settings: { endpoint: "http://127.0.0.1:9999/somewhere", provider: "openai" }, narrative: [{ kind: "body", text: "Borrowed prose." }], turnCheckpoints: [{ narrative: [] }] };
  fileSaveFixture(h, { "from-a-friend": { trusted: false, snapshot: foreign }, autosave: { trusted: true, snapshot: { ...foreign, sessionName: "The workspace" } } });
  await h.run("refreshDiskSaveList()");
  h.element("saved-session-select").options = [];
  h.run("renderSavedSessions()");
  const listed = h.element("saved-session-select").innerHTML;
  assert.match(listed, /value="file:from-a-friend">Borrowed story .* · saves folder only/);
  assert.doesNotMatch(listed, /file:autosave/, "the workspace mirror is not a library save");
  h.element("saved-session-select").value = "file:from-a-friend";
  await h.run("loadSelectedSession()");
  assert.equal(h.run("state.sessionName"), "Borrowed story");
  // Not written by this harness: the endpoint it names is withheld, as for any imported file.
  assert.equal(h.run("state.endpoint"), "");
  assert.equal(h.run("state.turnCheckpoints.length"), 0);
  assert.match(h.element("sessions-status").textContent, /loaded like an imported file.*custom backend endpoint was discarded/);
});

test("an empty browser restores the workspace from saves/autosave.json, and a signed file keeps its settings", async () => {
  const h = harness();
  const workspace = { format: "party-harness-session", version: 4, id: "session-home", savedAt: "2026-09-24T09:00:00Z", sessionName: "Before the data was cleared",
    settings: { endpoint: "http://127.0.0.1:8123/my-backend" }, narrative: [{ kind: "body", text: "Still here." }], turnCheckpoints: [] };
  fileSaveFixture(h, { autosave: { trusted: true, snapshot: workspace } });
  assert.equal(await h.run("restoreFromDiskAutosave()"), true);
  assert.equal(h.run("state.sessionName"), "Before the data was cleared");
  assert.equal(h.run("state.endpoint"), "http://127.0.0.1:8123/my-backend");
  assert.match(h.element("local-persistence-status").textContent, /restored from saves\/autosave\.json/);
  // Nothing to restore, or files turned off: the default scene stays.
  const empty = harness();
  fileSaveFixture(empty);
  assert.equal(await empty.run("restoreFromDiskAutosave()"), false);
  const off = harness();
  fileSaveFixture(off, { autosave: { trusted: true, snapshot: workspace } });
  off.run("diskSavesEnabled = false;");
  assert.equal(await off.run("restoreFromDiskAutosave()"), false);
});

test("the workspace mirror writes the current state and reports a failed copy without failing autosave", async () => {
  const h = harness();
  fileSaveFixture(h);
  h.run("storageReady = true; autosaveEnabled = true; state.sessionName = 'Mirrored';");
  await h.run("flushDiskAutosave()");
  assert.equal(h.context.files.autosave.snapshot.sessionName, "Mirrored");
  h.run("fetchWithTimeout = async () => ({ ok: false, status: 500, json: async () => ({ error: 'disk full' }) });");
  await h.run("flushDiskAutosave()");
  assert.match(h.run("state.diskSaveError"), /could not be written: disk full/);
});

// Three characters: Ash feels strongly toward Bo, Bo barely back, and nobody has recorded feelings
// toward Cy yet. Bo's entry changed on the current turn.
function webFixture() {
  const h = harness();
  h.run(`
    state.party = ['Ash Vale', 'Bo', 'Cy'].map(name => ({id: name.split(' ')[0].toLowerCase(), name, color: '#5b625c', stats: [50, 50, 50], muted: false, initiative: true}));
    const rel = (sourceId, targetId, values, lastReason = '') => ({sourceId, targetId, affection: 0, trust: 0, respect: 0, tension: 0, fear: 0, obligation: 0, ...values, lastReason});
    state.worldState.relationships = [rel('ash', 'bo', {affection: 62, trust: 10}, 'Shared the last umbrella.'), rel('bo', 'ash', {affection: 18, trust: 12})];
    state.relationshipTimeline = [{id: 'relation-1', turn: state.turn, sourceId: 'bo', targetId: 'ash', dimension: 'affection', delta: 4, reason: ''}];
  `);
  return h;
}
const webCell = (markup, source, target) => {
  const match = markup.match(new RegExp('<button class="([^"]*)"[^>]*data-web-source="' + source + '" data-web-target="' + target + '"[^>]*aria-label="([^"]*)">([^<]*)</button>'));
  return match && { classes: match[1].split(" "), label: match[2], text: match[3] };
};

test("the relationship web shows each direction, marks lopsided and fresh bonds, and replaces the flat list", () => {
  const h = webFixture();
  h.run("renderWorldState()");
  const markup = h.element("world-state-panel").innerHTML;
  const ashToBo = webCell(markup, "ash", "bo"), boToAsh = webCell(markup, "bo", "ash");
  assert.equal(ashToBo.text, "+62");
  assert.ok(ashToBo.classes.includes("lopsided"), "62 against 18 is a one-sided bond");
  assert.ok(!ashToBo.classes.includes("recent"));
  assert.match(ashToBo.label, /^Ash Vale → Bo: affection \+62, trust \+10, respect 0, tension 0, fear 0, obligation 0\. Much higher than Bo&#039;s affection back\. Why: Shared the last umbrella\./);
  assert.ok(boToAsh.classes.includes("recent"), "changed on the current turn");
  assert.equal(webCell(markup, "cy", "ash").text, "·", "no feelings recorded yet is not the same as zero");
  assert.equal(webCell(markup, "ash", "ash"), null, "nobody has a relationship with themselves");
  assert.doesNotMatch(markup, /<h5>Relationships<\/h5>/, "the flat list moves into the web instead of repeating");
  assert.match(markup, /<details class="web-list"><summary>All values as a list \(2\)<\/summary>.*data-world-group="relationships"/);
  // Another dimension: trust is 10 against 12, which is not lopsided.
  h.run("relationshipWebDimension = 'trust'; renderWorldState();");
  const trust = webCell(h.element("world-state-panel").innerHTML, "ash", "bo");
  assert.equal(trust.text, "+10");
  assert.ok(!trust.classes.includes("lopsided"));
  assert.match(h.element("world-state-panel").innerHTML, /data-web-dimension="trust" aria-pressed="true"/);
});

test("a party of one has no web and keeps the plain world list", () => {
  const h = webFixture();
  h.run("state.party = state.party.slice(0, 1); state.worldState.relationships = []; renderWorldState();");
  const markup = h.element("world-state-panel").innerHTML;
  assert.doesNotMatch(markup, /relationship-web/);
  assert.match(markup, /No mechanical state yet/);
});

test("picking a web square edits that direction, or starts one with both characters chosen", () => {
  const h = webFixture();
  let focused = "";
  for (const key of ["sourceId", "trust"]) h.element("world-field-" + key).focus = () => { focused = key; };
  h.run("relationshipWebDimension = 'trust'; openRelationshipCell('bo', 'ash');");
  assert.equal(h.run("worldEditor.index"), 1, "the existing Bo → Ash entry");
  assert.equal(focused, "trust", "starts in the field for the feeling on screen");
  h.run("openRelationshipCell('cy', 'bo');");
  assert.equal(h.run("worldEditor.index"), null);
  const fields = h.element("world-editor-fields").innerHTML;
  assert.match(fields, /<select id="world-field-sourceId" required>.*<option value="cy" selected>Cy<\/option>/);
  assert.match(fields, /<select id="world-field-targetId" required>.*<option value="bo" selected>Bo<\/option>/);
  // The ADD menu is unchanged: nobody is chosen for you.
  h.run("openWorldEditor('relationships');");
  assert.doesNotMatch(h.element("world-editor-fields").innerHTML, /<option value="[a-z]+" selected>/);
});

test("a relationship correction tells the engine whose bond it was", () => {
  const h = webFixture();
  h.run("openWorldEditor('relationships', 0);");
  const form = { sourceId: "ash", targetId: "bo", affection: "62", trust: "40", respect: "0", tension: "0", fear: "0", obligation: "0", lastReason: "Shared the last umbrella." };
  for (const [key, value] of Object.entries(form)) h.element("world-field-" + key).value = value;
  h.run("commitWorldEdit();");
  assert.equal(h.run("state.worldState.relationships[0].trust"), 40);
  assert.equal(h.run("state.worldState.corrections.at(-1).text"), "Player set Relationships: Ash Vale → Bo — trust: 10 → 40");
});

test("re-rendering the web keeps keyboard focus and an open list", () => {
  const h = webFixture();
  const focused = [];
  const button = dataset => ({ dataset, addEventListener() {}, focus() { focused.push(dataset); } });
  h.context.document.activeElement = { dataset: { webSource: "bo", webTarget: "ash" } };
  h.element("world-state-panel").querySelectorAll = selector =>
    selector === "[data-web-source]" ? [button({ webSource: "ash", webTarget: "bo" }), button({ webSource: "bo", webTarget: "ash" })]
    : selector === "[data-web-dimension]" ? [button({ webDimension: "affection" })]
    : selector === ".web-list" ? [{ open: true }] : [];
  h.run("renderWorldState()");
  assert.deepEqual(focused.map(dataset => ({ ...dataset })), [{ webSource: "bo", webTarget: "ash" }]);
  assert.match(h.element("world-state-panel").innerHTML, /<details class="web-list" open>/);
});

test("web labels stay distinct when two characters share a first name", () => {
  const h = webFixture();
  h.run("state.party[1].name = 'Ash Cole'; renderWorldState();");
  const markup = h.element("world-state-panel").innerHTML;
  assert.match(markup, /<th scope="row" title="Ash Vale">.*?<span aria-hidden="true">Ash Vale<\/span>/);
  assert.match(markup, /<th scope="col" title="Ash Cole">.*?<span aria-hidden="true">AC<\/span>/);
  assert.match(markup, /<th scope="row" title="Cy">.*?<span aria-hidden="true">Cy<\/span>/);
});

// Each reply sets the same fact differently, so a flipped-to reply shows its own consequences.
function swipeFixture() {
  const h = harness();
  h.run(`
    requestLiveTurn = () => new Promise((resolve, reject) => { globalThis.turnReply = resolve; globalThis.turnFail = reject; });
    maybeSummarize = () => {};
    state.narrative = [{kind: 'body', text: 'The gate is shut.'}];
    state.worldState.flags = {};
  `);
  h.answer = async (pending, name) => {
    h.context.turnReply({ result: { narration: "Reply " + name, beats: [{ kind: "narration", text: "Reply " + name, stateChanges: { flagChanges: [{ key: "gate", value: name }] } }] }, requestBytes: 1 });
    await pending;
  };
  h.shown = () => h.run("state.narrative.filter(line => line.kind === 'body').at(-1).text + ' / ' + state.worldState.flags.gate");
  return h;
}

test("regenerate keeps the reply it replaces, and ‹ › flips between replies with their own consequences", async () => {
  const h = swipeFixture();
  await h.answer(h.run("handleTurn('open the gate')"), "A");
  assert.equal(h.shown(), "Reply A / A");
  assert.equal(h.element("reply-flip").hidden, true, "one reply has nothing to flip to");
  await h.answer(h.run("regenerateLastTurn()"), "B");
  assert.equal(h.shown(), "Reply B / B");
  assert.equal(h.run("state.turnCheckpoints.length"), 1, "still one turn");
  assert.equal(h.element("reply-flip").hidden, false);
  assert.equal(h.element("reply-position").textContent, "2 / 2");
  h.run("showReply(-1)");
  assert.equal(h.shown(), "Reply A / A");
  assert.equal(h.run("state.narrative.filter(line => line.kind === 'choice').length"), 1, "the action appears once");
  h.run("renderTurnControls()");
  assert.equal(h.element("reply-position").textContent, "1 / 2");
  assert.equal(h.element("previous-reply").disabled, true);
  await h.answer(h.run("regenerateLastTurn()"), "C");
  assert.equal(h.element("reply-position").textContent, "3 / 3");
  h.run("showReply(-1)");
  assert.equal(h.shown(), "Reply B / B");
  h.run("showReply(-1)");
  assert.equal(h.shown(), "Reply A / A");
  // Undo removes the turn with every reply to it.
  h.run("undoLastTurn()");
  assert.equal(h.run("state.turnCheckpoints.length"), 0);
  assert.equal(h.run("state.narrative.length"), 1);
  assert.equal(h.run("state.worldState.flags.gate"), undefined);
});

test("a failed or cancelled regenerate brings back the reply it would have replaced", async () => {
  const h = swipeFixture();
  await h.answer(h.run("handleTurn('open the gate')"), "A");
  const failed = h.run("regenerateLastTurn()");
  h.context.turnFail(new Error("Nothing is answering."));
  await failed;
  assert.equal(h.shown(), "Reply A / A");
  assert.match(h.run("state.narrative.at(-1).text"), /^Regenerating failed, so the previous reply is back\. Nothing is answering\./);
  assert.equal(h.run("state.turnTraces.at(-1).status"), "failed");
  h.element("response-input").value = "";
  h.run("regenerateLastTurn(); cancelTurn();");
  assert.equal(h.shown(), "Reply A / A");
  assert.equal(h.run("state.turnCheckpoints.length"), 1, "cancelling a regenerate keeps the turn");
  assert.equal(h.element("response-input").value, "", "the reply is back, so the action is not");
  // The earlier error line is not part of the kept reply.
  await h.answer(h.run("regenerateLastTurn()"), "B");
  h.run("showReply(-1)");
  assert.equal(h.run("state.narrative.at(-1).kind"), "body");
  // A first attempt that fails still leaves the action to regenerate, as before.
  const fresh = swipeFixture();
  const first = fresh.run("handleTurn('open the gate')");
  fresh.context.turnFail(new Error("Nothing is answering."));
  await first;
  assert.equal(fresh.run("state.narrative.at(-1).text"), "Nothing is answering.");
  await fresh.answer(fresh.run("regenerateLastTurn()"), "A");
  assert.equal(fresh.element("reply-flip").hidden, true, "a failed attempt is not a reply");
});

test("kept replies store only what differs from the turn, and survive a trusted save round trip", async () => {
  const h = swipeFixture();
  h.run("state.archive = Array.from({length: 40}, (_, i) => ({kind: 'body', text: 'older line ' + i}));");
  await h.answer(h.run("handleTurn('open the gate')"), "A");
  await h.answer(h.run("regenerateLastTurn()"), "B");
  const kept = JSON.parse(h.run("JSON.stringify(state.turnCheckpoints.at(-1).replies[0])"));
  assert.equal(kept.archive.shared, 40);
  assert.equal(kept.archive.tail.length, 0);
  assert.equal(kept.narrative.shared, 1);
  assert.deepEqual(kept.narrative.tail.map(line => line.text), ["open the gate", "Reply A"]);
  assert.equal("storySummary" in kept, false);
  const saved = h.run("JSON.stringify(HarnessStorage.pack(sessionSnapshot()))");
  const loaded = swipeFixture();
  loaded.run("applySessionSnapshot(JSON.parse(" + JSON.stringify(saved) + "), {trusted: true}); renderTurnControls();");
  assert.equal(loaded.element("reply-position").textContent, "2 / 2");
  loaded.run("showReply(-1)");
  assert.equal(loaded.shown(), "Reply A / A");
  assert.equal(loaded.run("state.archive.length"), 40);
});

test("a regenerate interrupted by a reload can still flip back, and its replacement keeps the replies", async () => {
  const h = swipeFixture();
  await h.answer(h.run("handleTurn('open the gate')"), "A");
  h.run("regenerateLastTurn()");
  // Saved mid-request: the transcript ends in the action, with reply A kept on the checkpoint.
  const saved = h.run("JSON.stringify(HarnessStorage.pack(sessionSnapshot()))");
  const loaded = swipeFixture();
  loaded.run("applySessionSnapshot(JSON.parse(" + JSON.stringify(saved) + "), {trusted: true}); renderTurnControls();");
  assert.equal(loaded.element("reply-flip").hidden, false);
  assert.equal(loaded.element("reply-position").textContent, "– / 1");
  assert.equal(loaded.element("next-reply").disabled, true);
  // Regenerating from here keeps A and does not keep the half-finished attempt.
  await loaded.answer(loaded.run("regenerateLastTurn()"), "B");
  assert.equal(loaded.element("reply-position").textContent, "2 / 2");
  loaded.run("showReply(-1)");
  assert.equal(loaded.shown(), "Reply A / A");
});

test("a turn from before swipes keeps its reply when regenerated", async () => {
  const h = swipeFixture();
  await h.answer(h.run("handleTurn('open the gate')"), "A");
  h.run("delete state.turnCheckpoints.at(-1).replies;");
  await h.answer(h.run("regenerateLastTurn()"), "B");
  assert.equal(h.element("reply-position").textContent, "2 / 2");
  h.run("showReply(-1)");
  assert.equal(h.shown(), "Reply A / A");
});

test("at the reply limit the oldest kept reply gives way, never the one on screen", async () => {
  const h = swipeFixture();
  await h.answer(h.run("handleTurn('open the gate')"), "R1");
  for (let n = 2; n <= 10; n += 1) await h.answer(h.run("regenerateLastTurn()"), "R" + n);
  assert.equal(h.element("reply-position").textContent, "10 / 10");
  for (let n = 0; n < 9; n += 1) h.run("showReply(-1)");
  assert.equal(h.shown(), "Reply R1 / R1");
  await h.answer(h.run("regenerateLastTurn()"), "R11");
  assert.equal(h.element("reply-position").textContent, "10 / 10");
  const kept = JSON.parse(h.run("JSON.stringify(state.turnCheckpoints.at(-1).replies.slice(0, -1).map(reply => reply.worldState.flags.gate))"));
  assert.deepEqual(kept, ["R1", "R3", "R4", "R5", "R6", "R7", "R8", "R9", "R10"]);
});

test("flipping waits for an open line edit", async () => {
  const h = swipeFixture();
  await h.answer(h.run("handleTurn('open the gate')"), "A");
  await h.answer(h.run("regenerateLastTurn()"), "B");
  h.run("state.narrativeEdit = { lineId: state.narrative.at(-1).id, text: 'half-typed' }; showReply(-1);");
  assert.equal(h.shown(), "Reply B / B");
  assert.equal(h.run("state.narrativeEdit.text"), "half-typed");
});

test("undoing the next turn brings back the replies of the turn before it", async () => {
  const h = swipeFixture();
  await h.answer(h.run("handleTurn('open the gate')"), "A");
  await h.answer(h.run("regenerateLastTurn()"), "B");
  await h.answer(h.run("handleTurn('walk through')"), "C");
  assert.equal(h.element("reply-flip").hidden, true, "the new turn has one reply");
  h.run("undoLastTurn(); renderTurnControls();");
  assert.equal(h.shown(), "Reply B / B");
  assert.equal(h.element("reply-flip").hidden, false);
  assert.equal(h.element("reply-position").textContent, "2 / 2");
  h.run("showReply(-1)");
  assert.equal(h.shown(), "Reply A / A");
});

// A turn that ends in a check, answered, so the next step is the player's ROLL.
async function pendingCheckFixture() {
  const h = swipeFixture();
  h.run("showDiceResult = () => { globalThis.diceShown = (globalThis.diceShown || 0) + 1; };");
  const pending = h.run("handleTurn('force the door')");
  h.context.turnReply({ result: { narration: "The door resists.", beats: [{ kind: "narration", text: "The door resists." }, { kind: "check", prompt: "Force the door", checkStat: h.run("state.statDefinitions[0].id"), difficulty: 50 }] }, requestBytes: 1 });
  await pending;
  assert.equal(h.run("state.pendingPause.pauseType"), "check");
  return h;
}
const checkLines = h => h.run("state.narrative.filter(line => line.kind === 'check').map(line => line.text)");

test("undoing a check result returns to the check, and rolling it again gives the same number", async () => {
  const h = await pendingCheckFixture();
  const seed = h.run("state.pendingPause.checkSeed");
  await h.answer(h.run("resolvePendingCheck()"), "A");
  const [rolled] = checkLines(h);
  assert.match(rolled, /rolled \d+, needed \d+ or over/);
  h.element("response-input").value = "";
  h.run("undoLastTurn()");
  assert.equal(h.element("response-input").value, "", "the harness's CHECK RESULT message is not the player's action");
  assert.equal(h.run("state.pendingPause && state.pendingPause.pauseType"), "check");
  assert.equal(h.run("state.pendingPause.checkSeed"), seed);
  assert.equal(checkLines(h).length, 0, "the roll is undone with its turn");
  assert.equal(h.run("state.worldState.recentChecks.length"), 0);
  await h.answer(h.run("resolvePendingCheck()"), "B");
  assert.deepEqual(Array.from(checkLines(h)), [rolled]);
});

test("regenerating a check result replays the same roll once and keeps the earlier reply", async () => {
  const h = await pendingCheckFixture();
  await h.answer(h.run("resolvePendingCheck()"), "A");
  const [rolled] = checkLines(h);
  await h.answer(h.run("regenerateLastTurn()"), "B");
  assert.equal(h.shown(), "Reply B / B");
  assert.deepEqual(Array.from(checkLines(h)), [rolled], "one check line, with the same roll");
  assert.equal(h.run("state.worldState.recentChecks.length"), 1);
  assert.equal(h.context.diceShown, 1, "a replayed roll does not throw the dice again");
  assert.equal(h.run("state.narrative.filter(line => line.kind === 'choice' && line.text.startsWith('CHECK RESULT')).length"), 1);
  h.run("showReply(-1)");
  assert.equal(h.shown(), "Reply A / A");
});

test("cancelling a check result returns to the check without typing it into the box", async () => {
  const h = await pendingCheckFixture();
  h.element("response-input").value = "";
  h.run("resolvePendingCheck(); cancelTurn();");
  assert.equal(h.element("response-input").value, "");
  assert.equal(h.run("state.pendingPause && state.pendingPause.pauseType"), "check");
  assert.equal(checkLines(h).length, 0);
});

test("undoing a check result saved before checkpoints were marked still leaves the box alone", async () => {
  const h = await pendingCheckFixture();
  await h.answer(h.run("resolvePendingCheck()"), "A");
  // The old checkpoint was taken after the roll and had no marker.
  h.run("const last = state.turnCheckpoints.at(-1); delete last.checkResult;");
  h.element("response-input").value = "";
  h.run("undoLastTurn()");
  assert.equal(h.element("response-input").value, "");
});
