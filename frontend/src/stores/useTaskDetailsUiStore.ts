import { create } from 'zustand';

interface TaskUiState {
  loading: boolean;
  isStopping: boolean;
  deletingFiles: Set<string>;
  fileToDelete: string | null;
  // Additional UI state can be added here
}

interface UiStateMap {
  [taskId: string]: TaskUiState;
}

interface TaskDetailsUiStore {
  ui: UiStateMap;
  getUiState: (taskId: string) => TaskUiState;
  setUiState: (taskId: string, partial: Partial<TaskUiState>) => void;
  clearUiState: (taskId: string) => void;
}

const createDefaultUiState = (): TaskUiState => ({
  loading: false,
  isStopping: false,
  deletingFiles: new Set(),
  fileToDelete: null,
});

const useTaskDetailsUiStore = create<TaskDetailsUiStore>((set, get) => ({
  ui: {},

  getUiState: (taskId: string) => {
    return get().ui[taskId] ?? createDefaultUiState();
  },

  setUiState: (taskId: string, partial: Partial<TaskUiState>) => {
    set((state) => ({
      ui: {
        ...state.ui,
        [taskId]: (() => {
          const previousState = state.ui[taskId] ?? createDefaultUiState();
          return {
            ...createDefaultUiState(),
            ...previousState,
            ...partial,
            // Ensure each task always has its own Set instance.
            deletingFiles: partial.deletingFiles
              ? new Set(partial.deletingFiles)
              : new Set(previousState.deletingFiles),
          };
        })(),
      },
    }));
  },

  clearUiState: (taskId: string) => {
    set((state) => {
      const newUi = { ...state.ui };
      delete newUi[taskId];
      return { ui: newUi };
    });
  },
}));

export const useTaskStopping = (taskId?: string) => {
  const { getUiState, setUiState } = useTaskDetailsUiStore();
  const { isStopping } = taskId ? getUiState(taskId) : { isStopping: false };

  return {
    isStopping,
    setIsStopping: (value: boolean) =>
      taskId ? setUiState(taskId, { isStopping: value }) : undefined,
  };
};
