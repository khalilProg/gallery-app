import {
  AutoTokenizer,
  CLIPTextModelWithProjection,
  AutoProcessor,
  CLIPVisionModelWithProjection,
} from "@huggingface/transformers";

const CLIP_MODEL = "Xenova/clip-vit-base-patch32";

console.log("[download-models] 1/5 CLIP text tokenizer...");
await AutoTokenizer.from_pretrained(CLIP_MODEL);

console.log("[download-models] 2/5 CLIP text model...");
await CLIPTextModelWithProjection.from_pretrained(CLIP_MODEL, { dtype: "fp32" });

console.log("[download-models] 3/5 CLIP vision processor...");
await AutoProcessor.from_pretrained(CLIP_MODEL);

console.log("[download-models] 4/5 CLIP vision model...");
await CLIPVisionModelWithProjection.from_pretrained(CLIP_MODEL, { dtype: "fp32" });

console.log("[download-models] ✓ All CLIP models cached successfully.");
