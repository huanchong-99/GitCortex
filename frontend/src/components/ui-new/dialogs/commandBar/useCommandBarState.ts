import { useReducer, useCallback, useRef } from 'react';
import type {
  PageId,
  ResolvedGroupItem,
} from '@/components/ui-new/actions/pages';
import type {
  ActionDefinition,
  GitActionDefinition,
} from '@/components/ui-new/actions';

export type CommandBarState =
  | { status: 'browsing'; page: PageId; stack: PageId[]; search: string }
  | {
      status: 'selectingRepo';
      stack: PageId[];
      search: string;
      pendingAction: GitActionDefinition;
    };

export type CommandBarEvent =
  | { type: 'RESET'; page: PageId }
  | { type: 'SEARCH_CHANGE'; query: string }
  | { type: 'GO_BACK' }
  | { type: 'SELECT_ITEM'; item: ResolvedGroupItem };

export type CommandBarEffect =
  | { type: 'none' }
  | { type: 'execute'; action: ActionDefinition; repoId?: string };

const browsing = (page: PageId, stack: PageId[] = []): CommandBarState => ({
  status: 'browsing',
  page,
  stack,
  search: '',
});

const noEffect: CommandBarEffect = { type: 'none' };

function handleReset(event: Extract<CommandBarEvent, { type: 'RESET' }>): [CommandBarState, CommandBarEffect] {
  return [browsing(event.page), noEffect];
}

function handleSearchChange(
  state: CommandBarState,
  event: Extract<CommandBarEvent, { type: 'SEARCH_CHANGE' }>
): [CommandBarState, CommandBarEffect] {
  return [{ ...state, search: event.query }, noEffect];
}

function handleGoBack(state: CommandBarState): [CommandBarState, CommandBarEffect] {
  const prevPage = state.stack.at(-1);
  if (state.status === 'browsing' && !prevPage) return [state, noEffect];
  return [browsing(prevPage ?? 'root', state.stack.slice(0, -1)), noEffect];
}

function handleSelectRepo(
  state: Extract<CommandBarState, { status: 'selectingRepo' }>,
  repoId: string
): [CommandBarState, CommandBarEffect] {
  return [
    browsing('root'),
    {
      type: 'execute',
      action: state.pendingAction,
      repoId,
    },
  ];
}

function handleSelectPage(
  state: Extract<CommandBarState, { status: 'browsing' }>,
  pageId: PageId
): [CommandBarState, CommandBarEffect] {
  return [
    {
      ...state,
      page: pageId,
      stack: [...state.stack, state.page],
      search: '',
    },
    noEffect,
  ];
}

function handleSelectAction(
  state: Extract<CommandBarState, { status: 'browsing' }>,
  action: ActionDefinition,
  repoCount: number
): [CommandBarState, CommandBarEffect] {
  if (action.requiresTarget === 'git') {
    if (repoCount === 1) {
      return [
        state,
        { type: 'execute', action, repoId: '__single__' },
      ];
    }
    if (repoCount > 1) {
      return [
        {
          status: 'selectingRepo',
          stack: [...state.stack, state.page],
          search: '',
          pendingAction: action,
        },
        noEffect,
      ];
    }
  }
  return [state, { type: 'execute', action }];
}

function handleSelectItem(
  state: CommandBarState,
  event: Extract<CommandBarEvent, { type: 'SELECT_ITEM' }>,
  repoCount: number
): [CommandBarState, CommandBarEffect] {
  if (state.status === 'selectingRepo' && event.item.type === 'repo') {
    return handleSelectRepo(state, event.item.repo.id);
  }

  if (state.status === 'browsing') {
    const { item } = event;
    if (item.type === 'page') {
      return handleSelectPage(state, item.pageId);
    }
    if (item.type === 'action') {
      return handleSelectAction(state, item.action, repoCount);
    }
  }

  return [state, noEffect];
}

function reducer(
  state: CommandBarState,
  event: CommandBarEvent,
  repoCount: number
): [CommandBarState, CommandBarEffect] {
  switch (event.type) {
    case 'RESET':
      return handleReset(event);
    case 'SEARCH_CHANGE':
      return handleSearchChange(state, event);
    case 'GO_BACK':
      return handleGoBack(state);
    case 'SELECT_ITEM':
      return handleSelectItem(state, event, repoCount);
    default:
      return [state, noEffect];
  }
}

export function useCommandBarState(initialPage: PageId, repoCount: number) {
  // Use refs to avoid stale closures and keep dispatch stable
  const stateRef = useRef<CommandBarState>(browsing(initialPage));
  const repoCountRef = useRef(repoCount);
  repoCountRef.current = repoCount;

  const [state, rawDispatch] = useReducer(
    (s: CommandBarState, e: CommandBarEvent) => {
      const [newState] = reducer(s, e, repoCountRef.current);
      stateRef.current = newState;
      return newState;
    },
    browsing(initialPage)
  );

  // Keep stateRef in sync
  stateRef.current = state;

  // Stable dispatch that doesn't change on every render
  const dispatch = useCallback(
    (event: CommandBarEvent): CommandBarEffect => {
      const [, effect] = reducer(stateRef.current, event, repoCountRef.current);
      rawDispatch(event);
      return effect;
    },
    [] // No dependencies - uses refs for current values
  );

  return {
    state,
    currentPage: (state.status === 'selectingRepo'
      ? 'selectRepo'
      : state.page) as PageId,
    canGoBack: state.stack.length > 0,
    dispatch,
  };
}
