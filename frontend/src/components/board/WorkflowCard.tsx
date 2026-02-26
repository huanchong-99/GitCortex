import { cn } from '@/lib/utils';

interface WorkflowCardProps {
  readonly name: string;
  readonly status: string;
  readonly selected: boolean;
  readonly onClick: () => void;
}

export function WorkflowCard({ name, status, selected, onClick }: Readonly<WorkflowCardProps>) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left p-2 rounded border transition-colors',
        selected ? 'border-brand bg-brand/10' : 'border-border hover:bg-secondary'
      )}
    >
      <div className="text-sm font-semibold">{name}</div>
      <div className="text-xs text-low">{status}</div>
    </button>
  );
}
