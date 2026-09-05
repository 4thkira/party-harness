// SPDX-License-Identifier: GPL-3.0-only
// Adapts the harness's text requests without changing its story response contract.
const PRESETS = Object.freeze({
  anthropic: { base: 'https://api.anthropic.com/v1', key: 'ANTHROPIC_API_KEY' },
  gemini: { base: 'https://generativelanguage.googleapis.com/v1beta/openai', key: 'GEMINI_API_KEY' },
  openrouter: { base: 'https://openrouter.ai/api/v1', key: 'OPENROUTER_API_KEY' },
  deepseek: { base: 'https://api.deepseek.com/v1', key: 'DEEPSEEK_API_KEY' },
  groq: { base: 'https://api.groq.com/openai/v1', key: 'GROQ_API_KEY' },
  ollama: { base: 'http://127.0.0.1:11434/v1', local: true },
  lmstudio: { base: 'http://127.0.0.1:1234/v1', local: true },
  compatible: { base: '', key: 'COMPATIBLE_API_KEY', local: true }
});
function providerName(settings = {}) {
  const name = settings.provider || 'openai';
  if (name !== 'openai' && name !== 'novelai' && !Object.hasOwn(PRESETS, name)) throw new Error('Unknown text provider. Choose one in Settings.');
  return name;
}
function endpointFor(provider, settings = {}) {
  const preset = PRESETS[provider];
  if (!preset) throw new Error('No compatible endpoint for this provider.');
  const raw = preset.local ? String(settings.apiBaseUrl || preset.base).trim() : preset.base;
  let url;
  try { url = new URL(raw); } catch { throw new Error('Enter a valid API base URL in Settings, such as http://127.0.0.1:1234/v1.'); }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash || (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback))) {
    throw new Error('API base URLs must use HTTPS, or HTTP on localhost, with no embedded credentials, query, or fragment.');
  }
  if (provider !== 'compatible' && preset.local && !loopback) throw new Error('Use Custom OpenAI-compatible for a remote server. Local presets only connect to this computer.');
  url.pathname = url.pathname.replace(/\/+$/, '') + (provider === 'anthropic' ? '/messages' : '/chat/completions');
  return url;
}
function buildRequest(payload, settings, apiKey) {
  const provider = providerName(settings), url = endpointFor(provider, settings);
  if (!String(settings.model || '').trim()) throw new Error('Enter the exact model ID from your provider or local server in Settings.');
  const format = payload.text && payload.text.format;
  let system = String(payload.instructions || '');
  if (format && format.schema) system += '\nReturn only JSON matching this schema:\n' + JSON.stringify(format.schema);
  const content = typeof payload.input === 'string' ? payload.input : JSON.stringify(payload.input);
  const body = { model: settings.model.trim(), messages: [{ role: 'system', content: system }, { role: 'user', content }], max_tokens: payload.max_output_tokens || 4096, stream: false };
  let headers = apiKey ? { Authorization: 'Bearer ' + apiKey } : {};
  if (provider === 'anthropic') {
    body.system = system;
    body.messages.shift();
    headers = { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' };
    if (format && format.schema) {
      body.tools = [{ name: 'emit_result', description: 'Return the requested structured result.', input_schema: format.schema }];
      body.tool_choice = { type: 'tool', name: 'emit_result' };
    }
  } else if (format && format.schema) {
    const mode = settings.structuredOutput || (['ollama', 'lmstudio'].includes(provider) ? 'schema' : 'json');
    if (!['schema', 'json', 'prompt'].includes(mode)) throw new Error('Unknown structured output mode.');
    if (mode === 'schema') body.response_format = { type: 'json_schema', json_schema: { name: format.name || 'result', strict: true, schema: format.schema } };
    else if (mode === 'json') body.response_format = { type: 'json_object' };
  }
  return { url, body, headers };
}
function normalizeResponse(response, provider) {
  if (provider === 'anthropic') {
    if (response.stop_reason === 'max_tokens') throw new Error('The model ran out of output tokens. Try a shorter response or a model with a larger output allowance.');
    const tool = (response.content || []).find(part => part.type === 'tool_use' && part.name === 'emit_result');
    return { output_text: tool ? JSON.stringify(tool.input) : (response.content || []).filter(part => part.type === 'text').map(part => part.text).join('\n') };
  }
  const choice = response.choices && response.choices[0];
  if (choice && choice.finish_reason === 'length') throw new Error('The model truncated its reply. Try a shorter response or a model with a larger output allowance.');
  const content = choice && choice.message && choice.message.content;
  if (typeof content !== 'string' || !content.trim()) throw new Error('The provider returned no usable text. Check model compatibility and structured output mode.');
  return { output_text: content };
}
module.exports = { PRESETS, providerName, endpointFor, buildRequest, normalizeResponse };
