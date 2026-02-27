import {
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
  ReactNode,
} from 'react';
import type { PatchTypeWithKey } from '@/hooks/useConversationHistory';

interface EntriesContextType {
  entries: PatchTypeWithKey[];
  setEntries: (entries: PatchTypeWithKey[]) => void;
  reset: () => void;
}

const EntriesContext = createContext<EntriesContextType | null>(null);

interface EntriesProviderProps {
  children: ReactNode;
}

export const EntriesProvider = ({ children }: EntriesProviderProps) => {
  const [entries, setEntries] = useState<PatchTypeWithKey[]>([]);

  const updateEntries = useCallback((newEntries: PatchTypeWithKey[]) => {
    setEntries(newEntries);
  }, []);

  const reset = useCallback(() => {
    setEntries([]);
  }, []);

  const value = useMemo(
    () => ({
      entries,
      setEntries: updateEntries,
      reset,
    }),
    [entries, updateEntries, reset]
  );

  return (
    <EntriesContext.Provider value={value}>{children}</EntriesContext.Provider>
  );
};

export const useEntries = (): EntriesContextType => {
  const context = useContext(EntriesContext);
  if (!context) {
    throw new Error('useEntries must be used within an EntriesProvider');
  }
  return context;
};
