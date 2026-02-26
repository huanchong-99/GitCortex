import { ReactNode, useRef } from 'react';
import { PortalContainerContext } from '@/contexts/PortalContainerContext';
import { ToastProvider } from '@/components/ui/toast';
import NiceModal from '@ebay/nice-modal-react';
import '@/styles/legacy/index.css';

interface LegacyDesignScopeProps {
  children: ReactNode;
}

export function LegacyDesignScope({ children }: Readonly<LegacyDesignScopeProps>) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref} className="legacy-design min-h-screen">
      <PortalContainerContext.Provider value={ref}>
        <ToastProvider>
          <NiceModal.Provider>{children}</NiceModal.Provider>
        </ToastProvider>
      </PortalContainerContext.Provider>
    </div>
  );
}
