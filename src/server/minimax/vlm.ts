import { minimaxPost } from "./client";

type VlmResponse = {
  content: string;
};

export async function analyzeDesign(
  imageBuffer: ArrayBuffer,
  mimeType: string
): Promise<string> {
  const b64 = Buffer.from(imageBuffer).toString("base64");
  const dataUri = `data:${mimeType};base64,${b64}`;

  const resp = await minimaxPost<VlmResponse>(
    "/v1/coding_plan/vlm",
    {
      prompt: `You are analyzing a UI design screenshot for a developer who will code it.

Describe in precise detail:
1. LAYOUT: structure — header, hero, sections, footer. Grid/flex patterns.
2. COLORS: backgrounds, text, accents (hex if visible).
3. TYPOGRAPHY: sizes, weights, font style (serif/sans).
4. COMPONENTS: buttons, inputs, cards, nav.
5. SPACING: padding and gaps.
6. CONTENT: visible headlines and labels.

Be extremely specific. The developer codes only from this description.`,
      image_url: dataUri,
    },
    60_000
  );

  return resp.content;
}
