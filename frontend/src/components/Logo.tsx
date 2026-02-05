export function Logo() {
  return (
    <svg
      width="140"
      height="28"
      viewBox="0 0 140 28"
      xmlns="http://www.w3.org/2000/svg"
      className="logo"
    >
      <defs>
        <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="currentColor" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.8" />
        </linearGradient>
      </defs>
      <text
        x="0"
        y="20"
        fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        fontSize="20"
        fontWeight="700"
        fill="currentColor"
        letterSpacing="-0.5"
      >
        GitCortex
      </text>
    </svg>
  );
}
