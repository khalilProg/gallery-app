import {
  AutoTokenizer,
  CLIPTextModelWithProjection,
  AutoProcessor,
  CLIPVisionModelWithProjection,
  env,
} from "@huggingface/transformers";

import { CLIP_MODEL } from "../lib/indexing.ts";

if (process.env.CLIP_CACHE_DIR) env.cacheDir = process.env.CLIP_CACHE_DIR;

console.log("[download-models] 1/4 CLIP text tokenizer...");
await AutoTokenizer.from_pretrained(CLIP_MODEL);

console.log("[download-models] 2/4 CLIP text model...");
await CLIPTextModelWithProjection.from_pretrained(CLIP_MODEL, { dtype: "fp32" });

console.log("[download-models] 3/4 CLIP vision processor...");
await AutoProcessor.from_pretrained(CLIP_MODEL);

console.log("[download-models] 4/4 CLIP vision model...");
await CLIPVisionModelWithProjection.from_pretrained(CLIP_MODEL, { dtype: "fp32" });

console.log("[download-models] ✓ All CLIP models cached successfully.");
