/*
Party Harness - Copyright (C) 2026 Party Harness contributors
SPDX-License-Identifier: GPL-3.0-only
*/
"use strict";

const IMAGE_PRESETS = Object.freeze({
  openai: { label: "OpenAI Images API", key: "OPENAI_IMAGE_API_KEY" },
  novelai: { label: "NovelAI Image API", key: "NOVELAI_IMAGE_API_KEY" },
  stability: { label: "Stability AI", base: "https://api.stability.ai/v2beta/stable-image/generate/core", key: "STABILITY_API_KEY" },
  compatible: { label: "Custom OpenAI-compatible images", local: true, key: "COMPATIBLE_IMAGE_API_KEY" }
});
function providerName(value) { return Object.hasOwn(IMAGE_PRESETS, value) ? value : "openai"; }
function compatibleUrl(value) {
  const raw = String(value || "http://127.0.0.1:8188/v1").trim();
  let url;
  try { url = new URL(raw); } catch { throw new Error("Enter a valid image API base URL, such as http://127.0.0.1:8188/v1."); }
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash || (url.protocol !== "https:" && !(url.protocol === "http:" && loopback))) throw new Error("Image API base URLs must use HTTPS, or HTTP on localhost, with no embedded credentials, query, or fragment.");
  url.pathname = url.pathname.replace(/\/+$/, "") + "/images/generations";
  return url;
}
module.exports = { IMAGE_PRESETS, providerName, compatibleUrl };
