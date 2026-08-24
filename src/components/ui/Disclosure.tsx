import { IconPlus } from './icons';

/**
 * Progressive disclosure with `<details>`, not a JavaScript accordion.
 *
 * Native disclosure is keyboard-operable, announced correctly, printable, and
 * findable by the browser's own in-page search — three things a div-based
 * accordion has to reimplement and usually gets wrong. The marker is replaced
 * with a rotating plus; the rotation is CSS-only and respects reduced motion.
 */
export function Disclosure({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className="group border-b border-[var(--surface-line)] first:border-t"
    >
      <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 py-5 text-sm uppercase tracking-[0.1em] marker:content-none [&::-webkit-details-marker]:hidden">
        {title}
        <IconPlus
          width={16}
          height={16}
          className="shrink-0 text-[var(--surface-muted)] transition-transform duration-[var(--duration-state)] ease-[var(--ease-boa)] group-open:rotate-45"
        />
      </summary>
      <div className="prose-boa pb-8 text-sm leading-relaxed text-[var(--surface-muted)]">
        {children}
      </div>
    </details>
  );
}

/**
 * Long-form fields written by an administrator. Line breaks are preserved and
 * nothing else is interpreted — the admin editor is plain text, so rendering it
 * as HTML would be an injection route for no editorial benefit.
 */
export function RichText({ value }: { value: string }) {
  const paragraphs = value.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  return (
    <>
      {paragraphs.map((paragraph, index) => (
        <p key={index} className="mb-4 whitespace-pre-line last:mb-0">
          {paragraph}
        </p>
      ))}
    </>
  );
}
