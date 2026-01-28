interface OrchestratorHeaderProps {
  name: string;
  status: string;
  model: string | null;
}

export function OrchestratorHeader({ name, status, model }: OrchestratorHeaderProps) {
  return (
    <div className="h-16 bg-panel border-b border-border px-6 flex items-center">
      <div className="flex-1">
        <div className="text-lg font-semibold">{name}</div>
        <div className="text-xs text-low">Status: {status} | Model: {model ?? 'n/a'}</div>
      </div>
      <div className="text-right text-xs">
        <div>Tokens Used</div>
        <div className="text-sm font-semibold">12.5k</div>
      </div>
    </div>
  );
}
