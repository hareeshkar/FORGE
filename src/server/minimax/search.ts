import type { ForgeSSEEvent } from "@/lib/types";
import { minimaxPost } from "./client";

type SearchResponse = {
  organic: Array<{ title: string; snippet: string; link: string }>;
};

export async function searchAndStreamDocs(
  query: string,
  emit: (event: ForgeSSEEvent) => Promise<void>
): Promise<{ context: string; resultCount: number }> {
  const resp = await minimaxPost<SearchResponse>("/v1/coding_plan/search", { q: query });

  const top = resp.organic.slice(0, 3);
  let context = "";

  for (const r of top) {
    await emit({
      type: "search_result",
      query,
      title: r.title,
      snippet: r.snippet,
      url: r.link,
    });
    context += `[${r.title}]\n${r.snippet}\n\n`;
  }

  return {
    context: context.slice(0, 800),
    resultCount: top.length,
  };
}
