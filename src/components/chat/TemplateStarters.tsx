"use client";

const TEMPLATES = [
  "Build a Stripe payment form with card input, amount display, and a pay button",
  "Build a beautiful landing page for a SaaS product with hero, features, pricing, and CTA",
  "Build a task manager app with add, complete, and delete functionality",
  "Build a weather dashboard with city search, temperature display, and a 5-day forecast layout",
  "Build a portfolio site for a creative designer with project cards and a contact section",
];

type Props = {
  onSelect: (prompt: string) => void;
  disabled?: boolean;
};

export default function TemplateStarters({ onSelect, disabled = false }: Props) {
  return (
    <div className="flex flex-col gap-2">
      <span
        style={{ color: "var(--forge-muted)" }}
        className="text-xs uppercase tracking-widest font-forge-body"
      >
        Start with a template
      </span>
      <div className="flex flex-wrap gap-2">
        {TEMPLATES.map((template) => (
          <button
            key={template}
            onClick={() => onSelect(template)}
            disabled={disabled}
            title={template}
            style={{
              background: "var(--forge-panel)",
              color: "var(--forge-fg)",
              border: "1px solid var(--forge-edge)",
            }}
            className="
              max-w-[220px] truncate
              px-3 py-1.5
              rounded-full
              text-xs font-forge-body
              transition-opacity transition-colors duration-150
              hover:border-[var(--forge-molt)] hover:text-[var(--forge-molt)]
              disabled:opacity-40 disabled:cursor-not-allowed
              cursor-pointer
            "
          >
            {template}
          </button>
        ))}
      </div>
    </div>
  );
}
