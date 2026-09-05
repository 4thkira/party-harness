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

// Manual browser regression fixture. No .env, credentials, or provider calls.
// Run: node browser-test-server.js, then visit the printed URL.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const port = Number(process.env.HARNESS_TEST_PORT || 18977);
const empty = () => Object.fromEntries(["feelingUpdates", "statDeltas", "relationshipDeltas", "inventoryChanges", "conditionChanges", "flagChanges", "clockChanges", "objectiveChanges", "memoryCandidates"].map(key => [key, []]));
http.createServer(async (req, res) => {
  const json = value => { if (res.destroyed) return; res.writeHead(200, {"Content-Type":"application/json"}); res.end(JSON.stringify(value)); };
  if (req.url === "/" || req.url === "/harness-storage.js") {
    res.writeHead(200, {"Content-Type":req.url === "/" ? "text/html; charset=utf-8" : "text/javascript", "Cache-Control":"no-store"});
    res.end(fs.readFileSync(path.join(__dirname, req.url === "/" ? "rp-party-harness-prototype.html" : "harness-storage.js")));
  } else if (req.url === "/storage-checks") {
    res.writeHead(200, {"Content-Type":"text/html; charset=utf-8"});
    res.end(`<!doctype html><title>Storage checks</title><h1>Isolated storage regression checks</h1><pre id="results">Running…</pre><script src="/harness-storage.js"></script><script>
      (async () => {
        const lines = [];
        const check = (name, condition) => { if (!condition) throw Error(name); lines.push('PASS ' + name); document.getElementById('results').textContent=lines.join('\\n'); };
        const current='party-harness-current-state-v1', library='party-harness-sessions-v1';
        await new Promise((resolve,reject)=> {const request=indexedDB.deleteDatabase('party-harness');request.onsuccess=resolve;request.onerror=()=>reject(request.error);request.onblocked=()=>reject(Error('Close other test tabs first'));});
        const old={format:'party-harness-session',version:3,sessionName:'Migration fixture',narrative:[{kind:'body',text:'Original prose'}],archive:[{kind:'body',text:'Older prose'}],turnCheckpoints:[]};
        localStorage.setItem(current,JSON.stringify(old));localStorage.setItem(library,JSON.stringify([{...old,id:'fixture'}]));
        await HarnessStorage.initialize();
        check('IndexedDB active',HarnessStorage.mode==='IndexedDB');
        check('legacy current migrated',HarnessStorage.get(current).narrative[0].text==='Original prose');
        check('legacy library migrated',HarnessStorage.get(library)[0].id==='fixture');
        check('legacy copy removed only after migration',localStorage.getItem(current)===null);
        const changed={...old,version:4,actionDraft:'Unsent action',narrativeEdit:{lineId:'one',text:'Unfinished edit'}};
        await HarnessStorage.put(current,changed);
        await HarnessStorage.initialize();
        check('reload keeps draft and prose',HarnessStorage.get(current).actionDraft==='Unsent action' && HarnessStorage.get(current).archive[0].text==='Older prose');
        const first=HarnessStorage.put(current,{...changed,sessionName:'first'});
        const second=HarnessStorage.put(current,{...changed,sessionName:'second'});
        await Promise.all([first,second]);
        check('queued writes preserve ordering',HarnessStorage.get(current).sessionName==='second');
        await HarnessStorage.remove(current);await HarnessStorage.remove(library);
        check('cleared saves do not resurrect',HarnessStorage.get(current)===undefined);
        document.getElementById('results').textContent+='\\nALL STORAGE CHECKS PASSED';
      })().catch(error=>document.getElementById('results').textContent+='\\nFAIL '+error.message);
    </script>`);
  } else if (req.url === "/api/health") json({ok:true,serverKeys:{openai:true,novelai:false},model:"fixture-provider"});
  else if (req.url === "/api/defaults") json({});
  else if (req.url === "/api/character-files") json({files:[]});
  else if (req.url === "/api/turn") {
    let raw="";for await (const part of req) raw+=part;
    const input=JSON.parse(raw);const changes=empty();
    changes.inventoryChanges=[{operation:"add",itemId:"fixture-key",name:"Brass key",quantity:1,holderId:"",note:"Found after the pause"}];
    changes.memoryCandidates=[{kind:"development",scope:"character",subjectId:input.party[0].id,targetId:"",text:"Growing more willing to accept help.",reason:"Two instances of trusting a companion in this test scene."}];
    const timer=setTimeout(()=>json({narration:"The room is quiet. A key is hidden nearby.",beats:[
      {kind:"narration",text:"The room is quiet. Something glints beneath a folded cloth.",stateChanges:empty()},
      {kind:"pause",prompt:"Reveal what lies under the cloth?",pauseType:"continue",stateChanges:empty()},
      {kind:"narration",text:"You find a brass key. Your companion offers to carry the light.",stateChanges:changes}
    ],bubbles:[],suggestions:["Ask about the key"],stateChanges:empty()}), /wait|cancel/i.test(input.action) ? 10000 : 300);
    res.on("close",()=>clearTimeout(timer));
  } else if (req.url === "/api/image") {
    // A delayed local image fixture makes loading/cancellation visible without provider calls.
    for await (const part of req) { /* consume the request */ }
    const timer=setTimeout(()=>json({imageDataUrl:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9S8AAAAASUVORK5CYII=",referenceCount:0}),10000);
    res.on("close",()=>clearTimeout(timer));
  } else if (req.url === "/api/summarize") json({summary:"The party explored a room and discovered a brass key."});
  else {res.writeHead(404);res.end("Not found");}
}).listen(port,"127.0.0.1",()=>console.log("Fixture UI: http://127.0.0.1:"+port+"/ — Storage checks: /storage-checks (test data only)"));
