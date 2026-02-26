import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
  useMemo,
} from 'react';

interface ApprovalFormState {
  isEnteringReason: boolean;
  denyReason: string;
}

interface ApprovalFormStateMap {
  [approvalId: string]: ApprovalFormState;
}

interface ApprovalFormContextType {
  getState: (approvalId: string) => ApprovalFormState;
  setState: (approvalId: string, partial: Partial<ApprovalFormState>) => void;
  clear: (approvalId: string) => void;
}

const ApprovalFormContext = createContext<ApprovalFormContextType | null>(null);

const defaultState: ApprovalFormState = {
  isEnteringReason: false,
  denyReason: '',
};

export function useApprovalForm(approvalId: string) {
  const context = useContext(ApprovalFormContext);
  if (!context) {
    throw new Error('useApprovalForm must be used within ApprovalFormProvider');
  }

  const state = context.getState(approvalId);

  const setIsEnteringReason = useCallback(
    (value: boolean) =>
      context.setState(approvalId, { isEnteringReason: value }),
    [approvalId, context]
  );

  const setDenyReason = useCallback(
    (value: string) => context.setState(approvalId, { denyReason: value }),
    [approvalId, context]
  );

  const clear = useCallback(
    () => context.clear(approvalId),
    [approvalId, context]
  );

  return {
    isEnteringReason: state.isEnteringReason,
    denyReason: state.denyReason,
    setIsEnteringReason,
    setDenyReason,
    clear,
  };
}

export function ApprovalFormProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [stateMap, setStateMap] = useState<ApprovalFormStateMap>({});

  const getState = useCallback(
    (approvalId: string): ApprovalFormState => {
      return stateMap[approvalId] ?? defaultState;
    },
    [stateMap]
  );

  const setState = useCallback(
    (approvalId: string, partial: Partial<ApprovalFormState>) => {
      setStateMap((prev) => {
        const current = prev[approvalId] ?? defaultState;
        const updated = { ...current, ...partial };
        return { ...prev, [approvalId]: updated };
      });
    },
    []
  );

  const clear = useCallback((approvalId: string) => {
    setStateMap((prev) => {
      const newMap = { ...prev };
      delete newMap[approvalId];
      return newMap;
    });
  }, []);

  const contextValue = useMemo(
    () => ({
      getState,
      setState,
      clear,
    }),
    [getState, setState, clear]
  );

  return (
    <ApprovalFormContext.Provider value={contextValue}>
      {children}
    </ApprovalFormContext.Provider>
  );
}
