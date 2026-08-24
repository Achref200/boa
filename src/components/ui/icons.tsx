import type { SVGProps } from 'react';

/**
 * Icons are drawn at 24px on a 1.25px stroke to sit beside Archivo at label
 * sizes without looking heavier than the type. Square line caps echo the mark's
 * cut serifs; there are no rounded caps anywhere in this set.
 */
const base = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.25,
  strokeLinecap: 'square',
  strokeLinejoin: 'miter',
  'aria-hidden': true,
  focusable: 'false',
} as const;

type P = SVGProps<SVGSVGElement>;

export const IconSearch = (p: P) => (
  <svg {...base} {...p}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>
);
export const IconCart = (p: P) => (
  <svg {...base} {...p}><path d="M4 6h2l2 12h9l2-8H7" /><path d="M9 21h.01M17 21h.01" /></svg>
);
export const IconUser = (p: P) => (
  <svg {...base} {...p}><circle cx="12" cy="8" r="4" /><path d="M4.5 20c1.5-4 4-6 7.5-6s6 2 7.5 6" /></svg>
);
export const IconMenu = (p: P) => (
  <svg {...base} {...p}><path d="M3 6h18M3 12h18M3 18h18" /></svg>
);
export const IconClose = (p: P) => (
  <svg {...base} {...p}><path d="m5 5 14 14M19 5 5 19" /></svg>
);
export const IconChevronDown = (p: P) => (
  <svg {...base} {...p}><path d="m5 9 7 7 7-7" /></svg>
);
export const IconArrowRight = (p: P) => (
  <svg {...base} {...p}><path d="M4 12h15M13 6l6 6-6 6" /></svg>
);
export const IconMinus = (p: P) => <svg {...base} {...p}><path d="M5 12h14" /></svg>;
export const IconPlus = (p: P) => <svg {...base} {...p}><path d="M12 5v14M5 12h14" /></svg>;
export const IconCheck = (p: P) => <svg {...base} {...p}><path d="m4 12 5 5L20 6" /></svg>;
export const IconAlert = (p: P) => (
  <svg {...base} {...p}><path d="M12 3 1.5 21h21L12 3Z" /><path d="M12 10v5M12 18h.01" /></svg>
);
export const IconGlobe = (p: P) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c4 4.5 4 12.5 0 17M12 3.5c-4 4.5-4 12.5 0 17" /></svg>
);
export const IconCalendar = (p: P) => (
  <svg {...base} {...p}><rect x="3.5" y="5" width="17" height="15" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg>
);
export const IconTrash = (p: P) => (
  <svg {...base} {...p}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>
);
