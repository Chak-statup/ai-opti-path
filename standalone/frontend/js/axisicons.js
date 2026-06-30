// axisicons.js — custom mono-stroke SVG icons for the four decision axes.
// Returns SVG markup strings; they inherit colour via currentColor.
const A =
  'width="30" height="30" viewBox="0 0 32 32" fill="none" stroke="currentColor" ' +
  'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';

export const AXIS_ICONS = {
  "01": `<svg ${A}>
    <rect x="4" y="4" width="9" height="9" rx="2" />
    <rect x="19" y="4" width="9" height="9" rx="2" />
    <rect x="4" y="19" width="9" height="9" rx="2" />
    <rect x="19" y="19" width="9" height="9" rx="2" />
    <path d="M13.5 8.5h5M8.5 13.5v5M23.5 13.5v5M13.5 23.5h5" stroke-dasharray="0.2 3" />
  </svg>`,
  "02": `<svg ${A}>
    <circle cx="6" cy="16" r="2.5" />
    <path d="M8.5 16h6" />
    <path d="M14.5 16c4 0 4 -8 8 -8M14.5 16c4 0 4 8 8 8M14.5 16h8" />
    <circle cx="25" cy="8" r="2.5" />
    <circle cx="25" cy="16" r="2.5" />
    <circle cx="25" cy="24" r="2.5" />
  </svg>`,
  "03": `<svg ${A}>
    <path d="M5 11V6a1 1 0 0 1 1 -1h5" />
    <path d="M27 11V6a1 1 0 0 0 -1 -1h-5" />
    <path d="M5 21v5a1 1 0 0 0 1 1h5" />
    <path d="M27 21v5a1 1 0 0 1 -1 1h-5" />
    <rect x="12.5" y="12.5" width="7" height="7" rx="1.5" />
    <path d="M16 9v3.5M16 19.5V23M9 16h3.5M19.5 16H23" />
  </svg>`,
  "04": `<svg ${A}>
    <path d="M5 27h22" />
    <path d="M5 27v-5h6v-6h6v-6h6v17" stroke-linejoin="round" />
    <path d="M5 23l18 -14" stroke-dasharray="2 3" />
    <circle cx="23" cy="9" r="2.4" />
  </svg>`,
};
