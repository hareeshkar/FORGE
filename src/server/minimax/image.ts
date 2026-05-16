import { minimaxPost } from "./client";

type ImageGenResponse = {
  data: { image_base64?: string[]; image_urls?: string[] };
  metadata: { success_count: string; failed_count: string };
};

export async function generateAsset(description: string): Promise<string> {
  const resp = await minimaxPost<ImageGenResponse>(
    "/v1/image_generation",
    {
      model: "image-01",
      prompt: `${description}. Professional web hero asset, sharp, modern UI illustration or photography style.`,
      aspect_ratio: "16:9",
      response_format: "base64",
      prompt_optimizer: true,
      n: 1,
    },
    120_000
  );

  const ok = parseInt(resp.metadata.success_count, 10);
  const b64 = resp.data.image_base64?.[0];
  if (ok < 1 || !b64) {
    throw new Error("Image generation produced no output");
  }

  return b64;
}
