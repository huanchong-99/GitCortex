import { useMemo, useCallback } from 'react';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';
import { useActions } from '@/contexts/ActionsContext';
import { Navbar } from '../views/Navbar';
import {
  NavbarActionGroups,
  type ActionDefinition,
  type ActionVisibilityContext,
} from '../actions';
import {
  useActionVisibilityContext,
  isActionVisible,
} from '../actions/useActionVisibility';

type DividerItem = { readonly type: 'divider' };

function isDivider(
  item: ActionDefinition | DividerItem
): item is DividerItem {
  return 'type' in item && item.type === 'divider';
}

/**
 * Filter items by visibility while normalizing divider placement
 * (no leading, trailing, or consecutive dividers).
 */
export function filterVisibleItemsWithDividers<
  T extends ActionDefinition | DividerItem,
>(
  items: readonly T[],
  ctx: ActionVisibilityContext
): T[] {
  // Filter actions by visibility, keep dividers
  const filtered = items.filter((item) => {
    if (isDivider(item)) return true;
    return isActionVisible(item, ctx);
  });

  // Remove leading/trailing dividers and consecutive dividers
  const result: T[] = [];
  for (const item of filtered) {
    if (isDivider(item)) {
      // Only add divider if we have items before it and last item wasn't a divider
      const lastItem = result.at(-1);
      if (result.length > 0 && lastItem && !isDivider(lastItem)) {
        result.push(item);
      }
    } else {
      result.push(item);
    }
  }

  // Remove trailing divider
  const lastItem = result.at(-1);
  if (result.length > 0 && lastItem && isDivider(lastItem)) {
    result.pop();
  }

  return result;
}

export function filterVisibleItemPair<
  TLeft extends ActionDefinition | DividerItem,
  TRight extends ActionDefinition | DividerItem,
>(
  leftItems: readonly TLeft[],
  rightItems: readonly TRight[],
  ctx: ActionVisibilityContext
): [TLeft[], TRight[]] {
  return [
    filterVisibleItemsWithDividers(leftItems, ctx),
    filterVisibleItemsWithDividers(rightItems, ctx),
  ];
}

export function NavbarContainer() {
  const { executeAction } = useActions();
  const { workspace: selectedWorkspace, isCreateMode } = useWorkspaceContext();

  // Get action visibility context (includes all state for visibility/active/enabled)
  const actionCtx = useActionVisibilityContext();

  // Action handler - all actions go through the standard executeAction
  const handleExecuteAction = useCallback(
    (action: ActionDefinition) => {
      if (action.requiresTarget && selectedWorkspace?.id) {
        executeAction(action, selectedWorkspace.id);
      } else {
        executeAction(action);
      }
    },
    [executeAction, selectedWorkspace?.id]
  );

  // Filter visible actions for each section
  const [leftItems, rightItems] = useMemo(
    () =>
      filterVisibleItemPair(
        NavbarActionGroups.left,
        NavbarActionGroups.right,
        actionCtx
      ),
    [actionCtx]
  );

  const navbarTitle = isCreateMode
    ? 'Create Workspace'
    : selectedWorkspace?.branch;

  return (
    <Navbar
      workspaceTitle={navbarTitle}
      leftItems={leftItems}
      rightItems={rightItems}
      actionContext={actionCtx}
      onExecuteAction={handleExecuteAction}
    />
  );
}
