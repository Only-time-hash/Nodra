export function NodraLogo({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="nodra-shared-logo-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#13b8ff" />
          <stop offset="1" stopColor="#126cff" />
        </linearGradient>
      </defs>
      <g fill="url(#nodra-shared-logo-gradient)">
        <path d="M31 5C20 5 13 10 9 19c9-1 16 3 22 12V5Z" />
        <path d="M59 31c0-11-5-18-14-22 1 9-3 16-12 22h26Z" />
        <path d="M33 59c11 0 18-5 22-14-9 1-16-3-22-12v26Z" />
        <path d="M5 33c0 11 5 18 14 22-1-9 3-16 12-22H5Z" />
      </g>
      <circle cx="32" cy="32" r="7" fill="#051b3c" />
    </svg>
  );
}
