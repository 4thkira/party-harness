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
});

