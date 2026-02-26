import { useTranslation } from 'react-i18next';
import { CaretDownIcon, ArrowSquareUpRightIcon } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { getFileIcon } from '@/utils/fileTypeIcon';
import { useTheme } from '@/components/ThemeProvider';
import { getActualTheme } from '@/utils/theme';
import { ToolStatus } from 'shared/types';
import { ToolStatusDot } from './ToolStatusDot';
import { DiffViewBody, useDiffData, type DiffInput } from './DiffViewCard';

interface ChatFileEntryProps {
  readonly filename: string;
  readonly additions?: number;
  readonly deletions?: number;
  readonly expanded?: boolean;
  readonly onToggle?: () => void;
  readonly className?: string;
  readonly status?: ToolStatus;
  /** Optional diff content for expanded view */
  readonly diffContent?: DiffInput;
  /** Optional callback to open file in changes panel */
  readonly onOpenInChanges?: () => void;
}

function DiffStats({ additions, deletions }: Readonly<{ additions?: number; deletions?: number }>) {
  const hasStats = additions !== undefined || deletions !== undefined;
  if (!hasStats) return null;
  return (
    <span className="text-sm shrink-0">
      {additions !== undefined && additions > 0 && (
        <span className="text-success">+{additions}</span>
      )}
      {additions !== undefined && deletions !== undefined && ' '}
      {deletions !== undefined && deletions > 0 && (
        <span className="text-error">-{deletions}</span>
      )}
    </span>
  );
}

function FileHeaderContent({
  filename,
  FileIcon,
  status,
  onOpenInChanges,
  additions,
  deletions,
  onToggle,
  expanded,
  viewInChangesLabel,
}: Readonly<{
  filename: string;
  FileIcon: React.ComponentType<{ className?: string }>;
  status?: ToolStatus;
  onOpenInChanges?: () => void;
  additions?: number;
  deletions?: number;
  onToggle?: () => void;
  expanded: boolean;
  viewInChangesLabel: string;
}>) {
  return (
    <>
      <div className="flex-1 flex items-center gap-base min-w-0">
        <span className="relative shrink-0">
          <FileIcon className="size-icon-base" />
          {status && (
            <ToolStatusDot status={status} className="absolute -bottom-0.5 -right-0.5" />
          )}
        </span>
        <span className="text-sm text-normal truncate">{filename}</span>
        {onOpenInChanges && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onOpenInChanges(); }}
            className="shrink-0 p-0.5 rounded hover:bg-muted text-low hover:text-normal transition-colors"
            title={viewInChangesLabel}
          >
            <ArrowSquareUpRightIcon className="size-icon-xs" />
          </button>
        )}
        <DiffStats additions={additions} deletions={deletions} />
      </div>
      {onToggle && (
        <CaretDownIcon
          className={cn(
            'size-icon-xs shrink-0 text-low transition-transform',
            !expanded && '-rotate-90'
          )}
        />
      )}
    </>
  );
}

export function ChatFileEntry({
  filename,
  additions,
  deletions,
  expanded = false,
  onToggle,
  className,
  status,
  diffContent,
  onOpenInChanges,
}: Readonly<ChatFileEntryProps>) {
  const { t } = useTranslation('tasks');
  const { theme } = useTheme();
  const actualTheme = getActualTheme(theme);
  const FileIcon = getFileIcon(filename, actualTheme);
  const isDenied = status?.status === 'denied';

  const diffData = useDiffData(
    diffContent ?? { type: 'unified', path: filename, unifiedDiff: '' }
  );
  const hasDiffContent = diffContent && diffData.isValid;

  const headerProps = {
    filename, FileIcon, status, onOpenInChanges, additions, deletions, onToggle, expanded,
    viewInChangesLabel: t('conversation.viewInChangesPanel'),
  };

  if (hasDiffContent) {
    const HeaderTag = onToggle ? 'button' : 'div';
    return (
      <div
        className={cn(
          'rounded-sm border overflow-hidden',
          isDenied && 'border-error bg-error/10',
          className
        )}
      >
        <HeaderTag
          {...(onToggle ? { type: 'button' as const, onClick: onToggle } : {})}
          className={cn(
            'flex items-center p-base w-full',
            isDenied ? 'bg-error/20' : 'bg-panel',
            onToggle && 'cursor-pointer text-left'
          )}
        >
          <FileHeaderContent {...headerProps} />
        </HeaderTag>
        {expanded && (
          <DiffViewBody
            diffFile={diffData.diffFile}
            diffData={diffData.diffData}
            isValid={diffData.isValid}
            hideLineNumbers={diffData.hideLineNumbers}
            theme={actualTheme}
          />
        )}
      </div>
    );
  }

  return (
    <div
      role={onToggle ? "button" : undefined}
      tabIndex={onToggle ? 0 : undefined}
      className={cn(
        'flex items-center border rounded-sm p-base w-full',
        isDenied ? 'bg-error/20 border-error' : 'bg-panel',
        onToggle && 'cursor-pointer',
        className
      )}
      onClick={onToggle}
      onKeyDown={onToggle ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle();
        }
      } : undefined}
    >
      <FileHeaderContent {...headerProps} />
    </div>
  );
}
