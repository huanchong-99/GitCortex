export function StatusBar() {
  return (
    <div className="h-8 bg-panel border-t border-border px-4 flex items-center text-xs">
      <span className="text-brand">Orchestrator Active</span>
      <span className="ml-4">3 Terminals Running</span>
      <span className="ml-4">Tokens: 12.5k</span>
      <span className="ml-4">Git: Listening</span>
    </div>
  );
}
