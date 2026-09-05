# API notes — verified shapes only

Anything here marked **UNVERIFIED** is from memory / docs and must be confirmed against a real call before relying on it. Update this file when a call is confirmed.

## Anthropic (TypeScript SDK `@anthropic-ai/sdk`) — verified from bundled SDK reference 2026-09-04

- Model: `claude-opus-5`. Thinking: `thinking: { type: "adaptive" }`. Do **not** pass `budget_tokens` (400 on Opus 5).
- Structured output: `client.messages.parse({ model, max_tokens, messages, output_config: { format: zodOutputFormat(Schema) } })` → `response.parsed_output` (null on parse failure — guard). Import `zodOutputFormat` from `@anthropic-ai/sdk/helpers/zod`. **Check compatibility with the repo's zod ^4** on first use.
- Vision: content block `{ type: "image", source: { type: "base64", media_type: "image/jpeg", data } }` placed before the text block.
- `max_tokens`: ~16000 non-streaming default; don't lowball.
- Client picks up `ANTHROPIC_API_KEY` from env. Not set on this machine yet.
- Effort: `output_config: { effort: "low" | "medium" | "high" | "xhigh" | "max" }` — use `low`/`medium` for the cataloguer, `high` for pricing.

## Sarvam AI — UNVERIFIED until first real call

Base URL `https://api.sarvam.ai`. Auth header `api-subscription-key: <SARVAM_API_KEY>`.

| Product | Endpoint (expected) | Purpose |
|---|---|---|
| Saarika | `POST /speech-to-text` (multipart: `file`, `language_code`, `model: saarika:v2`) | Native-script transcript |
| Saaras | `POST /speech-to-text-translate` (multipart: `file`, `model: saaras:v2`) | Indic speech → English text |
| Bulbul | `POST /text-to-speech` (JSON: `inputs[]`, `target_language_code`, `speaker`, `model: bulbul:v2`) → base64 wav `audios[]` | Read listing back |
| Mayura | `POST /translate` (JSON: `input`, `source_language_code`, `target_language_code`, `model: mayura:v1`) | EN ↔ HI |

Language codes are BCP-47 style: `hi-IN`, `bn-IN`, `ta-IN`, `te-IN`, `mr-IN`, `gu-IN`, `kn-IN`, `ml-IN`, `pa-IN`, `od-IN`, `en-IN`.
Credit budget: 1,000 free. Record remaining credits here after each phase.

## Voyage AI embeddings — UNVERIFIED

`POST https://api.voyageai.com/v1/multimodalembeddings`, header `Authorization: Bearer <VOYAGE_API_KEY>`, model `voyage-multimodal-3`, 1024 dims. Inputs are `[{ content: [{type:"text", text}, {type:"image_base64", image_base64}] }]`. Fallback if no key: text-only `voyage-3` or a local `@xenova/transformers` model.

## Background matting — UNVERIFIED

fal.ai `fal-ai/birefnet` or Replicate `briaai/RMBG-2.0`. Input image URL or base64; output PNG with alpha. Compose with `sharp`.
