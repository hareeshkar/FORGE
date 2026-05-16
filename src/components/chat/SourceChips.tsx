"use client";

type Props = {
  sources: Array<{ query: string; urls: string[] }>;
};

export function SourceChips({ sources }: Props) {
  if (!sources.length) return null;

  const links = sources.flatMap((s) =>
    s.urls.slice(0, 2).map((url) => ({ url, query: s.query }))
  );
  if (!links.length) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {links.map(({ url }, i) => {
        let host = url;
        try {
          host = new URL(url).hostname.replace("www.", "");
        } catch {
          /* keep url */
        }
        return (
          <a
            key={`${url}-${i}`}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-full border border-[color-mix(in_oklab,var(--forge-molt)_35%,transparent)] bg-[color-mix(in_oklab,var(--forge-molt)_12%,black)] px-2.5 py-1 font-forge-body text-[11px] text-[var(--forge-molt)] transition hover:bg-[color-mix(in_oklab,var(--forge-molt)_22%,black)]"
          >
            ◈ {host}
          </a>
        );
      })}
    </div>
  );
}
