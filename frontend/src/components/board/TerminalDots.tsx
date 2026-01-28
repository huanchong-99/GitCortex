interface TerminalDotsProps {
  terminalCount: number;
}

export function TerminalDots({ terminalCount }: TerminalDotsProps) {
  return (
    <div className="flex gap-1" aria-label="terminal-count">
      {Array.from({ length: terminalCount }).map((_, index) => (
        <span
          key={index}
          data-testid="terminal-dot"
          className="h-2 w-2 rounded-full bg-brand"
        />
      ))}
    </div>
  );
}
