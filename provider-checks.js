// SPDX-License-Identifier: GPL-3.0-only
const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { spawn } = require('node:child_process');
const path = require('node:path');
const { once } = require('node:events');
const adapter = require('./text-providers.js');
const imageAdapter = require('./image-providers.js');
const schema = { type: 'object', properties: { text: { type: 'string' } }, required: ['text'], additionalProperties: false };

test('image providers expose hosted, local UI, and compatible presets', () => {
  assert.equal(imageAdapter.providerName('stability'), 'stability');
  assert.equal(imageAdapter.providerName('unknown'), 'openai');
  assert.equal(imageAdapter.IMAGE_PRESETS.stability.key, 'STABILITY_API_KEY');
  assert.equal(imageAdapter.compatibleUrl('http://127.0.0.1:1234/v1').pathname, '/v1/images/generations');
  assert.equal(imageAdapter.localProviderUrl('automatic1111', '', 'sdapi/v1/txt2img').pathname, '/sdapi/v1/txt2img');
  assert.equal(imageAdapter.localProviderUrl('fooocus', '', 'v1/generation/text-to-image').pathname, '/v1/generation/text-to-image');
  assert.equal(imageAdapter.localProviderUrl('comfyui', '', 'prompt').pathname, '/prompt');
  assert.equal(imageAdapter.compatibleUrl('https://images.example/v1').protocol, 'https:');
  const replaced = imageAdapter.replaceWorkflowPlaceholders({positive:{text:'{{prompt}}'},negative:{text:'{{negative_prompt}}'}}, 'scene prompt', 'avoid text');
  assert.equal(replaced.workflow.positive.text, 'scene prompt');
  assert.equal(replaced.workflow.negative.text, 'avoid text');
  assert.equal(replaced.promptCount, 1);
  assert.equal(replaced.negativeCount, 1);
  assert.equal(imageAdapter.parseWorkflow('{"6":{"inputs":{"text":"{{prompt}}"}}}')['6'].inputs.text, '{{prompt}}');
  for (const url of ['http://images.example/v1', 'https://user:secret@images.example/v1', 'https://images.example/v1?token=secret', 'file:///tmp']) {
    assert.throws(() => imageAdapter.compatibleUrl(url));
  }
});
const payload = { instructions: 'Write a scene.', input: 'A quiet room.', max_output_tokens: 4096, text: { format: { name: 'scene', schema } } };

test('hosted presets pin their destination and isolate auth formats', () => {
  for (const provider of ['gemini', 'openrouter', 'deepseek', 'groq']) {
    const result = adapter.buildRequest(payload, { provider, model: 'test-model', apiBaseUrl: 'https://untrusted.example' }, 'test-secret');
    assert.ok(result.url.href.startsWith(adapter.PRESETS[provider].base));
    assert.equal(result.headers.Authorization, 'Bearer test-secret');
    assert.equal(result.body.response_format.type, 'json_object');
    assert.equal(result.body.reasoning, undefined);
  }
  const claude = adapter.buildRequest(payload, {provider:'anthropic', model:'test-model'}, 'test-secret');
  assert.equal(claude.url.pathname, '/v1/messages');
  assert.equal(claude.headers.Authorization, undefined);
  assert.equal(claude.headers['x-api-key'], 'test-secret');
  assert.deepEqual(claude.body.tools[0].input_schema, schema);
  assert.equal(claude.body.messages[0].role, 'user');
  assert.equal(adapter.normalizeResponse({content:[{type:'tool_use',name:'emit_result',input:{text:'scene'}}]},'anthropic').output_text, '{"text":"scene"}');
});

test('local compatibility modes, URL validation, and truncated outputs', () => {
  const local = adapter.buildRequest(payload, {provider:'ollama',model:'installed-model'}, '');
  assert.equal(local.url.href, 'http://127.0.0.1:11434/v1/chat/completions');
  assert.deepEqual(local.headers, {});
  assert.equal(local.body.response_format.type, 'json_schema');
  assert.equal(adapter.buildRequest(payload,{provider:'lmstudio',model:'model',structuredOutput:'prompt'},'').body.response_format, undefined);
  for (const apiBaseUrl of ['http://remote.example/v1','https://user:secret@example.com/v1','file:///tmp','https://example.com/v1?key=secret']) {
    assert.throws(()=>adapter.endpointFor('compatible',{apiBaseUrl}));
  }
  assert.throws(()=>adapter.endpointFor('ollama',{apiBaseUrl:'https://remote.example/v1'}));
  assert.throws(()=>adapter.buildRequest(payload,{provider:'ollama',model:''},''),/model ID/);
  assert.throws(()=>adapter.normalizeResponse({choices:[{finish_reason:'length',message:{content:'partial'}}]},'ollama'),/truncated/);
  assert.throws(()=>adapter.normalizeResponse({choices:[]},'groq'),/no usable text/);
});

test('an unusable RP_PORT stops the server with a message instead of a stack trace or port 0', () => {
  const { spawnSync } = require('node:child_process');
  for (const value of ['abc', '0', '70000']) {
    // The timeout only matters if validation regresses and the server starts listening.
    const result = spawnSync(process.execPath, [path.join(__dirname, 'server.js')], { cwd: __dirname, env: { ...process.env, RP_PORT: value }, encoding: 'utf8', timeout: 5000 });
    assert.equal(result.status, 1, 'RP_PORT=' + value + ' did not exit cleanly');
    assert.match(result.stderr, /RP_PORT in your environment must be a whole number from 1 to 65535/);
    assert.doesNotMatch(result.stderr, /node:internal|\n\s+at /);
  }
});

test('real local HTTP adapter covers turns, summaries, profiles, and scenarios without credentials', {timeout:20000}, async t => {
  const captured = [];
  const fixture = http.createServer(async (req,res) => {
    let raw=''; for await (const part of req) raw+=part;
    const body=raw ? JSON.parse(raw) : null; captured.push({body,headers:req.headers,url:req.url});
    const fixturePng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
    if (req.url === '/v1/images/generations') {
      res.writeHead(200,{'Content-Type':'application/json'});
      res.end(JSON.stringify({data:[{b64_json:fixturePng.toString('base64')}]}));
      return;
    }
    if (req.url === '/sdapi/v1/txt2img') {
      res.writeHead(200,{'Content-Type':'application/json'});
      res.end(JSON.stringify({images:[fixturePng.toString('base64')]}));
      return;
    }
    if (req.url === '/v1/generation/text-to-image') {
      res.writeHead(200,{'Content-Type':'application/json'});
      res.end(JSON.stringify([{base64:fixturePng.toString('base64')}]))
      return;
    }
    if (req.url === '/prompt') {
      res.writeHead(200,{'Content-Type':'application/json'});
      res.end(JSON.stringify({prompt_id:'fixture-prompt'}));
      return;
    }
    if (req.url === '/history/fixture-prompt') {
      res.writeHead(200,{'Content-Type':'application/json'});
      res.end(JSON.stringify({'fixture-prompt':{outputs:{'9':{images:[{filename:'fixture.png',subfolder:'',type:'output'}]}}}}));
      return;
    }
    if (req.url.startsWith('/view?')) {
      res.writeHead(200,{'Content-Type':'image/png'});
      res.end(fixturePng);
      return;
    }
    const name=body.response_format?.json_schema?.name;
    const result = name==='roleplay_turn' ? {narration:'The test room is quiet.',bubbles:[],suggestions:[]} : name==='character_profile' ? {name:'Fixture character'} : {sessionName:'Fixture scenario'};
    res.writeHead(200,{'Content-Type':'application/json'});
    res.end(JSON.stringify({choices:[{finish_reason:'stop',message:{content:name?JSON.stringify(result):'A brief test summary.'}}]}));
  });
  fixture.listen(0,'127.0.0.1'); await once(fixture,'listening');
  t.after(()=>{fixture.closeAllConnections();fixture.close();});
  const probe=http.createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');
  const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
  const child=spawn(process.execPath,[path.join(__dirname,'server.js')],{cwd:__dirname,env:{...process.env,RP_PORT:String(port),COMPATIBLE_API_KEY:'test-placeholder'},stdio:['ignore','pipe','pipe']});
  t.after(()=>child.kill());
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('Server startup timed out')),5000);
    child.stdout.on('data',data=>{if(String(data).includes('server listening')){clearTimeout(timer);resolve();}});
    child.once('error',error=>{clearTimeout(timer);reject(error);});
    child.once('exit',()=>{clearTimeout(timer);reject(Error('Server exited before startup'));});
  });
  const health=await (await fetch(`http://127.0.0.1:${port}/api/health`)).json();
  assert.equal(health.serverKeys.compatible,true);
  assert.equal(JSON.stringify(health).includes('test-placeholder'),false);
  const settings={provider:'ollama',model:'fixture-model',apiBaseUrl:`http://127.0.0.1:${fixture.address().port}/v1`};
  const cases=[['turn',{action:'Inspect room',party:[{id:'a',name:'A'}]},'text','The test room is quiet.'],['summarize',{lines:[{kind:'body',text:'A scene.'}]},'summary','A brief test summary.'],['character-profile',{content:'# Fixture character'},'name','Fixture character'],['session-setup',{prompt:'A test scenario'},'sessionName','Fixture scenario']];
  for(const [route,input,key,value] of cases){
    const response=await fetch(`http://127.0.0.1:${port}/api/${route}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...input,settings})});
    const result=await response.json();
    assert.equal(response.status,200,JSON.stringify(result));
    assert.equal(result[key],value);
  }
  // An unknown provider is the caller's mistake: a 400 that names it, not a generic 500.
  for(const route of ['turn','summarize','character-profile','session-setup']){
    const [input]=cases.find(entry=>entry[0]===route).slice(1);
    const response=await fetch(`http://127.0.0.1:${port}/api/${route}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...input,settings:{provider:'no-such-provider'}})});
    assert.equal(response.status,400,route);
    assert.match((await response.json()).error,/Unknown text provider/);
  }
  const imageResponse=await fetch(`http://127.0.0.1:${port}/api/image`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider:'compatible',apiBaseUrl:`http://127.0.0.1:${fixture.address().port}/v1`,apiKey:'image-test-key',model:'fixture-image-model',prompt:'A test image',size:'1024x1024',quality:'low'})});
  const imageResult=await imageResponse.json();
  assert.equal(imageResponse.status,200,JSON.stringify(imageResult));
  assert.match(imageResult.imageDataUrl,/^data:image\/png;base64,/);
  assert.equal(captured.length,5);
  for(const request of captured.slice(0,4)){assert.equal(request.headers.authorization,undefined);assert.equal(request.url,'/v1/chat/completions');assert.equal(request.body.model,'fixture-model');}
  const imageRequest=captured[4];
  assert.equal(imageRequest.url,'/v1/images/generations');
  assert.equal(imageRequest.headers.authorization,'Bearer image-test-key');
  assert.equal(imageRequest.body.model,'fixture-image-model');
  assert.equal(imageRequest.body.size,'1024x1024');
  const localImageCases=[
    {provider:'automatic1111',model:'fixture-checkpoint'},
    {provider:'fooocus',model:'fixture-fooocus-model'},
    {provider:'comfyui',model:'',workflow:'{"6":{"inputs":{"text":"{{prompt}}"}},"7":{"inputs":{"text":"{{negative_prompt}}"}}}'},
  ];
  for(const input of localImageCases){
    const response=await fetch(`http://127.0.0.1:${port}/api/image`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...input,apiBaseUrl:`http://127.0.0.1:${fixture.address().port}`,prompt:'A local test image',size:'1024x1024',quality:'medium'})});
    const result=await response.json();
    assert.equal(response.status,200,JSON.stringify(result));
    assert.match(result.imageDataUrl,/^data:image\/png;base64,/);
  }
  assert.equal(captured[5].url,'/sdapi/v1/txt2img');
  assert.equal(captured[5].body.override_settings.sd_model_checkpoint,'fixture-checkpoint');
  assert.equal(captured[6].url,'/v1/generation/text-to-image');
  assert.equal(captured[6].body.require_base64,true);
  assert.equal(captured[7].url,'/prompt');
  assert.equal(captured[7].body.prompt['6'].inputs.text,'A local test image');
  const expandedWorkflow = JSON.stringify({ '6': { inputs: { text: '{{prompt}}'.repeat(256) } } });
  const expandedResponse = await fetch(`http://127.0.0.1:${port}/api/image`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider:'comfyui',apiBaseUrl:`http://127.0.0.1:${fixture.address().port}`,prompt:'x'.repeat(12000),workflow:expandedWorkflow})});
  const expandedResult = await expandedResponse.json();
  assert.equal(expandedResponse.status,400,JSON.stringify(expandedResult));
  assert.match(expandedResult.error,/expands beyond the 1 MiB limit/i);
  assert.equal(captured.length,10);
});


test('model lists come from each provider\'s own route and hide models that cannot write a turn', () => {
  const openai = adapter.modelsRequest({ provider: 'openai' }, 'key');
  assert.equal(openai.url.href, 'https://api.openai.com/v1/models');
  assert.equal(openai.headers.Authorization, 'Bearer key');
  assert.equal(adapter.modelsRequest({ provider: 'novelai' }, 'key').url.href, 'https://text.novelai.net/oa/v1/models');
  const claude = adapter.modelsRequest({ provider: 'anthropic' }, 'key');
  assert.equal(claude.url.href, 'https://api.anthropic.com/v1/models?limit=1000');
  assert.equal(claude.headers['x-api-key'], 'key');
  assert.equal(claude.headers.Authorization, undefined);
  // OpenRouter lists models to anyone, so the key is checked on its own route.
  const openrouter = adapter.modelsRequest({ provider: 'openrouter' }, 'key');
  assert.equal(openrouter.url.href, 'https://openrouter.ai/api/v1/models');
  assert.equal(openrouter.keyCheck.href, 'https://openrouter.ai/api/v1/key');
  assert.equal(adapter.modelsRequest({ provider: 'ollama' }, '').url.href, 'http://127.0.0.1:11434/v1/models');
  assert.deepEqual(adapter.modelsRequest({ provider: 'ollama' }, '').headers, {});
  assert.throws(() => adapter.modelsRequest({ provider: 'ollama', apiBaseUrl: 'https://remote.example/v1' }, ''));

  const listed = adapter.normalizeModels({ data: [
    { id: 'gpt-fixture' }, { id: 'text-embedding-3-small' }, { id: 'whisper-1' }, { id: 'gpt-image-1' }, { id: 'gpt-fixture' },
    { id: 'models/gemini-fixture' }, { id: 'claude-fixture', display_name: 'Claude Fixture' }
  ] }, 'openai');
  assert.deepEqual(listed.models.map(model => model.id), ['claude-fixture', 'gemini-fixture', 'gpt-fixture']);
  assert.equal(listed.models[0].name, 'Claude Fixture');
  assert.equal(listed.hidden, 3);
  const routed = adapter.normalizeModels({ data: [
    { id: 'vendor/model:free', name: 'Model (free)', pricing: { prompt: '0', completion: '0' }, architecture: { output_modalities: ['text'] } },
    { id: 'vendor/paid', name: 'Paid', pricing: { prompt: '0.000001', completion: '0.000002' }, architecture: { output_modalities: ['text'] } },
    { id: 'vendor/painter', name: 'Painter', architecture: { output_modalities: ['image'] } }
  ] }, 'openrouter');
  assert.deepEqual(routed.models.map(model => [model.id, model.free]), [['vendor/model:free', true], ['vendor/paid', false]]);
  assert.equal(routed.hidden, 1);
});

async function startHarness(t, env = {}) {
  const probe = http.createServer(); probe.listen(0, '127.0.0.1'); await once(probe, 'listening');
  const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
  const child = spawn(process.execPath, [path.join(__dirname, 'server.js')], { cwd: __dirname, env: { ...process.env, ...env, RP_PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => child.kill());
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Server startup timed out')), 5000);
    child.stdout.on('data', data => { if (String(data).includes('server listening')) { clearTimeout(timer); resolve(); } });
    child.once('exit', () => { clearTimeout(timer); reject(Error('Server exited before startup')); });
  });
  return port;
}

test('CHECK CONNECTION lists local models and explains keys, missing routes, and servers that are not running', { timeout: 20000 }, async t => {
  const fixture = http.createServer((req, res) => {
    const reply = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
    if (req.url === '/v1/models') return reply(200, { object: 'list', data: [{ id: 'fixture-model' }, { id: 'nomic-embed-text' }, { id: 'another-model' }] });
    if (req.url === '/locked/v1/models') return reply(401, { error: { message: 'Invalid API key' } });
    reply(404, { error: 'not found' });
  });
  fixture.listen(0, '127.0.0.1'); await once(fixture, 'listening');
  t.after(() => { fixture.closeAllConnections(); fixture.close(); });
  const base = `http://127.0.0.1:${fixture.address().port}`;
  const closed = http.createServer(); closed.listen(0, '127.0.0.1'); await once(closed, 'listening');
  const closedPort = closed.address().port; await new Promise(resolve => closed.close(resolve));
  const port = await startHarness(t);
  const ask = async (route, body) => {
    const response = await fetch(`http://127.0.0.1:${port}/api/${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  };
  const listed = await ask('models', { settings: { provider: 'ollama', apiBaseUrl: base + '/v1' } });
  assert.equal(listed.status, 200, JSON.stringify(listed.body));
  assert.deepEqual(listed.body.models.map(model => model.id), ['another-model', 'fixture-model']);
  assert.equal(listed.body.hidden, 1);
  const locked = await ask('models', { settings: { provider: 'compatible', apiBaseUrl: base + '/locked/v1' } });
  assert.equal(locked.status, 401);
  assert.match(locked.body.error, /asked for a key \(HTTP 401\)/);
  const bare = await ask('models', { settings: { provider: 'compatible', apiBaseUrl: base + '/bare/v1' } });
  assert.equal(bare.status, 404);
  assert.match(bare.body.error, /does not list its models at \/bare\/v1\/models/);
  // Not "connect ECONNREFUSED 127.0.0.1:<port>": say what is not running and what to do.
  const stopped = await ask('models', { settings: { provider: 'lmstudio', apiBaseUrl: `http://127.0.0.1:${closedPort}/v1` } });
  assert.equal(stopped.status, 502);
  assert.equal(stopped.body.error, `Nothing is answering at http://127.0.0.1:${closedPort}. Start LM Studio's local server, check the address in Settings, and try again.`);
  const turn = await ask('turn', { action: 'Look around', party: [{ id: 'a', name: 'A' }], settings: { provider: 'ollama', model: 'fixture-model', apiBaseUrl: `http://127.0.0.1:${closedPort}/v1` } });
  assert.equal(turn.status, 502);
  assert.match(turn.body.error, /^Nothing is answering at .+ Start Ollama, check the address in Settings, and try again\.$/);
});
