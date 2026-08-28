export function Logo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      aria-label="Passionate to Serve"
      role="img"
    >
      <circle cx="24" cy="24" r="22" className="stroke-current" strokeWidth="2" opacity="0.25" />
      <path
        d="M24 8c-6.5 0-11 4.6-11 10.4 0 6.9 7 12.8 10.1 15.2a1.5 1.5 0 0 0 1.8 0C28 31.2 35 25.3 35 18.4 35 12.6 30.5 8 24 8Z"
        fill="currentColor"
        opacity="0.14"
      />
      <path
        d="M14 25.5 20.5 19l4 4L34 13"
        stroke="currentColor"
        strokeWidth="2.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M28 13h6v6"
        stroke="currentColor"
        strokeWidth="2.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
