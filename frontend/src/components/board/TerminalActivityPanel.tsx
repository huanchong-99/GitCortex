export function TerminalActivityPanel() {
  return (
    <div className="h-32 bg-panel border-t border-border p-4">
      <div className="text-sm font-semibold mb-2">Terminal Activity</div>
      <div className="space-y-1 text-xs font-mono text-low">
        <div>[T1] $ git status</div>
        <div>[T2] impl Login</div>
      </div>
    </div>
  );
}
