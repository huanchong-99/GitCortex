interface TerminalDetailPanelProps {
  role: string;
  status: string;
  model: string;
}

export function TerminalDetailPanel({ role, status, model }: Readonly<TerminalDetailPanelProps>) {
  return (
    <div className="p-3 bg-panel border border-border rounded">
      <div className="text-sm font-semibold">{role}</div>
      <div className="text-xs text-low">Status: {status}</div>
      <div className="text-xs text-low">Model: {model}</div>
    </div>
  );
}
