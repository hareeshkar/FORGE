import { minimaxPost } from "./client";

type M27Response = {
  choices: Array<{ message: { content: string } }>;
};

export async function extractSearchQueries(prompt: string): Promise<string[]> {
  const resp = await minimaxPost<M27Response>(
    "/v1/text/chatcompletion_v2",
    {
      model: "MiniMax-M2.7",
      messages: [
        {
          role: "user",
          content: `A developer wants to build this: "${prompt}"

List the specific libraries, frameworks, or APIs that need current documentation.
Return ONLY a JSON array of short search queries (max 2), e.g.:
["Tailwind CSS v4 utility classes", "Stripe.js checkout"]

If no specific libraries are mentioned, return: ["vanilla HTML CSS JS best practices 2026"]
Return ONLY the JSON array, nothing else.`,
        },
      ],
      temperature: 1.0,
      max_tokens: 256,
      n: 1,
    },
    60_000
  );

  const raw = resp.choices[0]?.message?.content?.trim() ?? "[]";
  try {
    const clean = raw.replace(/```json|```/g, "").trim();
    return JSON.parse(clean) as string[];
  } catch {
    return [`${prompt.slice(0, 60)} web development 2026`];
  }
}
