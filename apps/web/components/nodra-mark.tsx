export function NodraMark({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="nodraSharedGradient" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#f1fbff" />
          <stop offset="0.42" stopColor="#8fd7ff" />
          <stop offset="1" stopColor="#168cff" />
        </linearGradient>
      </defs>
      <g fill="url(#nodraSharedGradient)">
        <path d="M31 5C20 5 13 10 9 19c9-1 16 3 22 12V5Z" />
        <path d="M59 31c0-11-5-18-14-22 1 9-3 16-12 22h26Z" />
        <path d="M33 59c11 0 18-5 22-14-9 1-16-3-22-12v26Z" />
        <path d="M5 33c0 11 5 18 14 22-1-9 3-16 12-22H5Z" />
      </g>
      <circle cx="32" cy="32" r="7" fill="#061522" />
    </svg>
  );
}
