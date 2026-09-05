/*
Party Harness - Copyright (C) 2026 Party Harness contributors
SPDX-License-Identifier: GPL-3.0-only
*/
"use strict";

const IMAGE_PRESETS = Object.freeze({
  openai: { label: "OpenAI Images API", key: "OPENAI_IMAGE_API_KEY" },
  novelai: { label: "NovelAI Image API", key: "NOVELAI_IMAGE_API_KEY" },
  stability: { label: "Stability AI", base: "https://api.stability.ai/v2beta/stable-image/generate/core", key: "STABILITY_API_KEY" },
  automatic1111: { label: "AUTOMATIC1111 / Forge API", local: true, defaultBase: "http://127.0.0.1:7860" },
  fooocus: { label: "Fooocus API", local: true, defaultBase: "http://127.0.0.1:8888" },
  comfyui: { label: "ComfyUI workflow API", local: true, defaultBase: "http://127.0.0.1:8188", workflow: true },
  compatible: { label: "Custom OpenAI-compatible images", local: true, key: "COMPATIBLE_IMAGE_API_KEY" }
});
function providerName(value) { return Object.hasOwn(IMAGE_PRESETS, value) ? value : "openai"; }
function safeBaseUrl(value, fallback, label) {
  const raw = String(value || fallback).trim();
  let url;
  try { url = new URL(raw); } catch { throw new Error("Enter a valid " + label + " base URL."); }
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash || (url.protocol !== "https:" && !(url.protocol === "http:" && loopback))) throw new Error("Image API base URLs must use HTTPS, or HTTP on localhost, with no embedded credentials, query, or fragment.");
  return url;
}
function routeUrl(value, fallback, route, label = "image API") {
  const url = safeBaseUrl(value, fallback, label);
  const basePath = url.pathname.replace(/\/+$/, "");
  url.pathname = basePath + "/" + String(route || "").replace(/^\/+/, "");
  url.search = "";
  url.hash = "";
  return url;
}
function compatibleUrl(value) { return routeUrl(value, "http://127.0.0.1:1234/v1", "images/generations", "image API"); }
function localProviderUrl(provider, value, route) {
  const preset = IMAGE_PRESETS[provider];
  if (!preset || !preset.local) throw new Error("That image provider does not use a local API URL.");
  return routeUrl(value, preset.defaultBase, route, preset.label);
}
function replaceWorkflowPlaceholders(value, prompt, negativePrompt) {
  let promptCount = 0;
  let negativeCount = 0;
  const visit = item => {
    if (typeof item === "string") {
      const replaced = item
        .replace(/\{\{prompt\}\}/gi, () => { promptCount += 1; return prompt; })
        .replace(/\{\{negative_prompt\}\}/gi, () => { negativeCount += 1; return negativePrompt; });
      return replaced;
    }
    if (Array.isArray(item)) return item.map(visit);
    if (item && typeof item === "object") return Object.fromEntries(Object.entries(item).map(([key, child]) => [key, visit(child)]));
    return item;
  };
  return { workflow: visit(value), promptCount, negativeCount };
}
function parseWorkflow(value, maxBytes = 1024 * 1024) {
  const raw = String(value || "").trim();
  if (!raw) throw new Error("Paste a ComfyUI API-format workflow in Settings, with a {{prompt}} placeholder in its positive text node.");
  if (Buffer.byteLength(raw, "utf8") > maxBytes) throw new Error("The ComfyUI workflow is too large. Keep it under 1 MiB.");
  let parsed;
  try { parsed = JSON.parse(raw); } catch { throw new Error("The ComfyUI workflow must be valid JSON."); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("The ComfyUI workflow must be a JSON object exported in API format.");
  return parsed;
}
module.exports = { IMAGE_PRESETS, providerName, safeBaseUrl, routeUrl, compatibleUrl, localProviderUrl, replaceWorkflowPlaceholders, parseWorkflow };
