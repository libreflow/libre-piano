// Icônes SVG inline, style "app pro" : traits fins (1.6), formes arrondies,
// currentColor pour hériter de la couleur du texte. Remplacent les emojis
// dont le rendu varie selon l'OS et casse la cohérence visuelle.

import { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function base(props: IconProps) {
  return {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    ...props,
  };
}

export function PlayIcon(props: IconProps) {
  return (
    <svg {...base(props)} fill="currentColor" stroke="none">
      <path d="M8 5.5v13a.7.7 0 0 0 1.07.6l10.2-6.5a.7.7 0 0 0 0-1.2L9.07 4.9A.7.7 0 0 0 8 5.5Z" />
    </svg>
  );
}

export function StopIcon(props: IconProps) {
  return (
    <svg {...base(props)} fill="currentColor" stroke="none">
      <rect x="6.5" y="6.5" width="11" height="11" rx="2" />
    </svg>
  );
}

export function ImportIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 15V4m0 0 4 4m-4-4-4 4" />
      <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

export function KeyboardIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="7" width="18" height="11" rx="2" />
      <path d="M7 11h.01M11 11h.01M15 11h.01M18 11h.01M7 14.5h10" />
    </svg>
  );
}

export function TagsIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="4" y="5" width="16" height="6" rx="1.5" />
      <path d="M8 17h8M10 14h4" />
    </svg>
  );
}

export function ExpandIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M9 4H5a1 1 0 0 0-1 1v4M15 4h4a1 1 0 0 1 1 1v4M9 20H5a1 1 0 0 1-1-1v-4M15 20h4a1 1 0 0 0 1-1v-4" />
    </svg>
  );
}

export function CollapseIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 9V5a1 1 0 0 1 1-1h4M20 9V5a1 1 0 0 0-1-1h-4M4 15v4a1 1 0 0 0 1 1h4M20 15v4a1 1 0 0 1-1 1h-4" />
    </svg>
  );
}

export function SustainIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 4v11" />
      <path d="M8 19h8" />
      <path d="M12 15a3.2 3.2 0 0 0 3.2-3.2c0-1.8-1.4-2.6-3.2-4.6-1.8 2-3.2 2.8-3.2 4.6A3.2 3.2 0 0 0 12 15Z" />
    </svg>
  );
}

export function LoopIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M17 3.5 20 6l-3 2.5" />
      <path d="M20 6H8a4 4 0 0 0-4 4v1" />
      <path d="M7 20.5 4 18l3-2.5" />
      <path d="M4 18h12a4 4 0 0 0 4-4v-1" />
    </svg>
  );
}

export function VolumeIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 9.5v5h3l4.5 3.8V5.7L7 9.5H4Z" fill="currentColor" stroke="none" />
      <path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.7 7.7 0 0 1 0 11" />
    </svg>
  );
}

export function NoteIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M9 18.5V6l10-2v12.5" />
      <circle cx="6.5" cy="18.5" r="2.5" />
      <circle cx="16.5" cy="16.5" r="2.5" />
    </svg>
  );
}

export function StarIcon(props: IconProps) {
  return (
    <svg {...base(props)} fill="currentColor" stroke="none">
      <path d="M12 3.6l2.5 5.1 5.6.8-4 4 .9 5.6-5-2.7-5 2.7.9-5.6-4-4 5.6-.8L12 3.6Z" />
    </svg>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 7h16M10 4h4a1 1 0 0 1 1 1v2H9V5a1 1 0 0 1 1-1Z" />
      <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

export function PracticeIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 4 3 8.5l9 4.5 9-4.5L12 4Z" />
      <path d="M6.5 10.8V14c0 1.4 2.5 2.8 5.5 2.8s5.5-1.4 5.5-2.8v-3.2" />
      <path d="M21 8.5v5" />
    </svg>
  );
}
