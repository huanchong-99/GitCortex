import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { LayoutGrid, GitBranch, Bug } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

type ViewType = 'kanban' | 'pipeline' | 'debug';

interface ViewOption {
  id: ViewType;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  path: (workflowId?: string) => string;
  requiresWorkflow: boolean;
}

/**
 * View options matching actual route structure:
 * - /board (kanban, no workflow required)
 * - /pipeline/:workflowId (requires workflow)
 * - /debug/:workflowId (requires workflow)
 */
const VIEW_OPTIONS: ViewOption[] = [
  {
    id: 'kanban',
    labelKey: 'viewSwitcher.kanban',
    icon: LayoutGrid,
    path: () => '/board',
    requiresWorkflow: false,
  },
  {
    id: 'pipeline',
    labelKey: 'viewSwitcher.pipeline',
    icon: GitBranch,
    path: (workflowId) => workflowId ? `/pipeline/${workflowId}` : '/board',
    requiresWorkflow: true,
  },
  {
    id: 'debug',
    labelKey: 'viewSwitcher.debug',
    icon: Bug,
    path: (workflowId) => workflowId ? `/debug/${workflowId}` : '/board',
    requiresWorkflow: true,
  },
];

/**
 * Determine current view from pathname
 */
function getCurrentView(pathname: string): ViewType {
  if (pathname.startsWith('/debug/')) return 'debug';
  if (pathname.startsWith('/pipeline/')) return 'pipeline';
  return 'kanban';
}

export function NewDesignLayout() {
  const { t } = useTranslation('workflow');
  const location = useLocation();
  const navigate = useNavigate();
  const { workflowId } = useParams<{ workflowId?: string }>();

  const currentView = getCurrentView(location.pathname);

  const handleViewChange = (view: ViewOption) => {
    // Don't navigate to views that require workflow if we don't have one
    if (view.requiresWorkflow && !workflowId) {
      return;
    }
    navigate(view.path(workflowId));
  };

  // Show view switcher on board, pipeline, and debug pages
  const showViewSwitcher =
    location.pathname === '/board' ||
    location.pathname.startsWith('/pipeline/') ||
    location.pathname.startsWith('/debug/');

  return (
    <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
      {/* View Switcher Navigation */}
      {showViewSwitcher && (
        <div className="h-10 bg-panel border-b border-border px-4 flex items-center gap-1">
          {VIEW_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isActive = currentView === option.id;
            const isDisabled = option.requiresWorkflow && !workflowId;
            return (
              <button
                key={option.id}
                onClick={() => handleViewChange(option)}
                disabled={isDisabled}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors',
                  isActive
                    ? 'bg-brand/10 text-brand font-medium'
                    : isDisabled
                    ? 'text-low/50 cursor-not-allowed'
                    : 'text-low hover:text-high hover:bg-secondary'
                )}
                title={isDisabled ? t('viewSwitcher.selectWorkflowFirst') : undefined}
              >
                <Icon className="w-4 h-4" />
                {t(option.labelKey)}
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
