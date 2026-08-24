/**
 * The petal cluster from the BOA mark, redrawn as a clean vector.
 *
 * It is the only ornament the brand owns, and the only one this interface uses:
 * the seam between sections, the mark on an empty state, the "asset expected"
 * placeholder, and the seal that closes the footer. The original artwork is
 * never traced, scaled from the JPEG or recoloured — this is a separate drawing
 * of the same idea, five leaves fanned about a single base point, and it
 * inherits `currentColor` so it reads on ink and on paper alike.
 */
const LEAVES = [
  { angle: -52, ry: 10.5, opacity: 0.62 },
  { angle: -26, ry: 12.5, opacity: 0.82 },
  { angle: 0, ry: 14, opacity: 1 },
  { angle: 26, ry: 12.5, opacity: 0.82 },
  { angle: 52, ry: 10.5, opacity: 0.62 },
];

export function Petals({
  size = 24,
  className,
  title,
}: {
  size?: number;
  className?: string;
  title?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      <g fill="currentColor">
        {LEAVES.map((leaf) => (
          <ellipse
            key={leaf.angle}
            cx="24"
            cy={38 - leaf.ry}
            rx="4.1"
            ry={leaf.ry}
            opacity={leaf.opacity}
            transform={`rotate(${leaf.angle} 24 38)`}
          />
        ))}
      </g>
    </svg>
  );
}

/** Section seam: a hairline of the brand metal interrupted by the seal. */
export function SectionSeam({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-5 ${className ?? ''}`} aria-hidden="true">
      <span className="rule-gold flex-1" />
      <Petals size={20} className="shrink-0 text-[var(--surface-accent)]" />
      <span className="rule-gold flex-1" />
    </div>
  );
}
