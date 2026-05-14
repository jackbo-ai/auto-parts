import * as React from "react";

// Monogramme AutoParts — pignon mécanique sur fond navy → teal,
// rendu en SVG inline pour rester scalable et thémable.
export function BrandMark({
  className,
  title = "AutoParts",
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      role="img"
      aria-label={title}
      viewBox="0 0 48 48"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{title}</title>
      <defs>
        <linearGradient id="ap-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#5B0F12" />
          <stop offset="100%" stopColor="#DC2626" />
        </linearGradient>
      </defs>
      <rect
        x="2"
        y="2"
        width="44"
        height="44"
        rx="12"
        fill="url(#ap-bg)"
        stroke="rgba(255,255,255,0.18)"
        strokeWidth="1"
      />
      {/* Pignon — dents */}
      <g fill="#FECACA">
        <rect x="22" y="7" width="4" height="6" rx="1" />
        <rect x="22" y="35" width="4" height="6" rx="1" />
        <rect x="35" y="22" width="6" height="4" rx="1" />
        <rect x="7" y="22" width="6" height="4" rx="1" />
        <rect
          x="31.5"
          y="10.7"
          width="4"
          height="6"
          rx="1"
          transform="rotate(45 33.5 13.7)"
        />
        <rect
          x="12.5"
          y="31.3"
          width="4"
          height="6"
          rx="1"
          transform="rotate(45 14.5 34.3)"
        />
        <rect
          x="31.5"
          y="31.3"
          width="4"
          height="6"
          rx="1"
          transform="rotate(-45 33.5 34.3)"
        />
        <rect
          x="12.5"
          y="10.7"
          width="4"
          height="6"
          rx="1"
          transform="rotate(-45 14.5 13.7)"
        />
      </g>
      {/* Corps du pignon */}
      <circle cx="24" cy="24" r="11" fill="#FECACA" />
      <circle cx="24" cy="24" r="7.5" fill="#5B0F12" />
      {/* Moyeu central */}
      <circle cx="24" cy="24" r="3" fill="#FFFFFF" />
    </svg>
  );
}
