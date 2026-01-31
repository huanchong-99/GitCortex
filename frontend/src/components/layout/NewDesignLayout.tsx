import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { LayoutGrid, GitBranch, Bug } from 'lucide-react';
import { cn } from '@/lib/utils';

type ViewType = 'kanban' | 'pipeline' | 'debug';

interface ViewOption {
  id: ViewType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: (workflowId?: string) => string;
}

const VIEW_OPTIONS: ViewOption[] = [
  {
    id: 'kanban',
    label: 'Kanban',
    icon: LayoutGrid,
    path: (workflowId) => workflowId ? `/workflow/${workflowId}` : '/workflow',
  },
  {
    id: 'pipeline',
    label: 'Pipeline',
    icon: GitBranch,
    path: (workflowId) => workflowId ? `/workflow/${workflowId}/pipeline` : '/workflow',
  },
  {
    id: 'debug',
    label: 'Debug',
    icon: Bug,
    path: (workflowId) => workflowId ? `/workflow/${workflowId}/debug` : '/workflow',
  },
];

/**
 * Determine current view from pathname
 */
function getCurrentView(pathname: string): ViewType {
  if (pathname.includes('/debug')) return 'debug';
  if (pathname.includes('/pipeline')) return 'pipeline';
  return 'kanban';
}

export function NewDesignLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { workflowId } = useParams<{ workflowId?: string }>();

  const currentView = getCurrentView(location.pathname);

  const handleViewChange = (view: ViewOption) => {
    navigate(view.path(workflowId));
  };

  // Only show view switcher when we have a workflow context
  const showViewSwitcher = location.pathname.includes('/workflow/');

  return (
    <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
      {/* View Switcher Navigation */}
      {showViewSwitcher && (
        <div className="h-10 bg-panel border-b border-border px-4 flex items-center gap-1">
          {VIEW_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isActive = currentView === option.id;
            return (
              <button
                key={option.id}
                onClick={() => handleViewChange(option)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors',
                  isActive
                    ? 'bg-brand/10 text-brand font-medium'
                    : 'text-low hover:text-high hover:bg-secondary'
                )}
              >
                <Icon className="w-4 h-4" />
                {option.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}
