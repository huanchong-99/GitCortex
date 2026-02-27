import React, { useEffect, useRef, useState } from 'react';
import {
  readClipboardViaBridge,
  writeClipboardViaBridge,
} from '@/vscode/bridge';

type Point = { x: number; y: number };

function inIframe(): boolean {
  try {
    return globalThis.self !== globalThis.top;
  } catch {
    return true;
  }
}

function isEditable(
  target: EventTarget | null
): target is
  | HTMLInputElement
  | HTMLTextAreaElement
  | (HTMLElement & { isContentEditable: boolean }) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName?.toLowerCase();
  if (tag === 'input' || tag === 'textarea') return true;
  return !!el.isContentEditable;
}

async function readClipboardText(): Promise<string> {
  return await readClipboardViaBridge();
}
async function writeClipboardText(text: string): Promise<boolean> {
  return await writeClipboardViaBridge(text);
}

function getSelectedText(): string {
  const sel = globalThis.getSelection();
  return sel ? sel.toString() : '';
}

function cutFromInput(el: HTMLInputElement | HTMLTextAreaElement) {
  const start = el.selectionStart ?? 0;
  const end = el.selectionEnd ?? 0;
  if (end > start) {
    const selected = el.value.slice(start, end);
    void writeClipboardText(selected);
    const before = el.value.slice(0, start);
    const after = el.value.slice(end);
    el.value = before + after;
    el.setSelectionRange(start, start);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

function pasteIntoInput(
  el: HTMLInputElement | HTMLTextAreaElement,
  text: string
) {
  const start = el.selectionStart ?? 0;
  const end = el.selectionEnd ?? 0;
  const before = el.value.slice(0, start);
  const after = el.value.slice(end);
  el.value = before + text + after;
  const caret = start + text.length;
  el.setSelectionRange(caret, caret);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

type LegacyDocumentWithExecCommand = {
  execCommand?: (commandId: string, showUI?: boolean, value?: string) => boolean;
};

function runLegacyExecCommand(commandId: string, value?: string): boolean {
  const legacyDocument = document as unknown as LegacyDocumentWithExecCommand;
  const execCommand = legacyDocument.execCommand;
  if (typeof execCommand !== 'function') return false;
  return execCommand.call(document, commandId, false, value);
}

export const WebviewContextMenu: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState<Point>({ x: 0, y: 0 });
  const [adjustedPos, setAdjustedPos] = useState<Point | null>(null);
  const [canCut, setCanCut] = useState<boolean>(false);
  const [canPaste, setCanPaste] = useState<boolean>(false);
  const targetRef = useRef<EventTarget | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!inIframe()) return;
    const onContext = (e: MouseEvent) => {
      e.preventDefault();
      targetRef.current = e.target;
      setPos({ x: e.clientX, y: e.clientY });
      // Decide whether Cut should be shown: only for editable targets with a selection
      const tgt = e.target as HTMLElement | null;
      let cut = false;
      let paste = false;
      if (tgt && (tgt as HTMLInputElement).selectionStart !== undefined) {
        const el = tgt as HTMLInputElement | HTMLTextAreaElement;
        const start = el.selectionStart ?? 0;
        const end = el.selectionEnd ?? 0;
        cut = end > start && !el.readOnly && !el.disabled;
        paste = !el.readOnly && !el.disabled;
      } else if (isEditable(tgt)) {
        const sel = globalThis.getSelection();
        cut = !!sel && sel.toString().length > 0;
        paste = true;
      }
      setCanCut(cut);
      setCanPaste(paste);
      setVisible(true);
    };
    const onClick = () => setVisible(false);
    document.addEventListener('contextmenu', onContext);
    document.addEventListener('click', onClick);
    globalThis.addEventListener('blur', onClick);
    return () => {
      document.removeEventListener('contextmenu', onContext);
      document.removeEventListener('click', onClick);
      globalThis.removeEventListener('blur', onClick);
    };
  }, []);

  // When menu becomes visible, adjust position to stay within viewport
  useEffect(() => {
    if (!visible) {
      setAdjustedPos(null);
      return;
    }
    const el = menuRef.current;
    if (!el) return;
    // Use a microtask to ensure layout is ready
    const id = requestAnimationFrame(() => {
      const menuW = el.offsetWidth;
      const menuH = el.offsetHeight;
      const vw = globalThis.innerWidth;
      const vh = globalThis.innerHeight;
      const margin = 4;
      let x = pos.x;
      let y = pos.y;
      if (x + menuW + margin > vw) x = Math.max(margin, vw - menuW - margin);
      if (y + menuH + margin > vh) y = Math.max(margin, vh - menuH - margin);
      setAdjustedPos({ x, y });
    });
    return () => cancelAnimationFrame(id);
  }, [visible, pos]);

  useEffect(() => {
    if (!visible) return;
    const id = requestAnimationFrame(() => {
      focusMenuItem(0);
    });
    return () => cancelAnimationFrame(id);
  }, [visible, canCut, canPaste]);

  const close = () => setVisible(false);

  const focusMenuItem = (nextIndex: number) => {
    const menu = menuRef.current;
    if (!menu) return;
    const items = Array.from(
      menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')
    );
    if (items.length === 0) return;
    const normalizedIndex = ((nextIndex % items.length) + items.length) % items.length;
    items[normalizedIndex]?.focus();
  };

  const onCopy = async () => {
    const tgt = targetRef.current as HTMLElement | null;
    let copied = false;
    if (tgt && (tgt as HTMLInputElement).selectionStart !== undefined) {
      const el = tgt as HTMLInputElement | HTMLTextAreaElement;
      const start = el.selectionStart ?? 0;
      const end = el.selectionEnd ?? 0;
      if (end > start) {
        const selected = el.value.slice(start, end);
        copied = await writeClipboardText(selected);
      }
    }
    if (!copied) {
      const sel = getSelectedText();
      if (sel) copied = await writeClipboardText(sel);
    }
    if (!copied) {
      try {
        // Legacy fallback for environments where Clipboard API is unavailable
        runLegacyExecCommand('copy');
      } catch {
        /* empty */
      }
    }
    close();
  };

  const onCut = async () => {
    const tgt = targetRef.current as HTMLElement | null;
    if (
      tgt &&
      (tgt as HTMLInputElement).selectionStart !== undefined &&
      !(tgt as HTMLInputElement).readOnly &&
      !(tgt as HTMLInputElement).disabled
    ) {
      cutFromInput(tgt as HTMLInputElement | HTMLTextAreaElement);
    } else if (isEditable(tgt)) {
      // contentEditable: emulate cut by copying selection, then deleting via execCommand
      const sel = getSelectedText();
      if (sel) {
        await writeClipboardText(sel);
        try {
          // Legacy fallback for contentEditable cut operation
          runLegacyExecCommand('delete');
        } catch {
          /* empty */
        }
      }
    } else {
      // Read-only content: treat Cut as Copy for usability
      const sel = getSelectedText();
      if (sel) await writeClipboardText(sel);
    }
    close();
  };

  const onPaste = async () => {
    const text = await readClipboardText();
    const tgt = targetRef.current as HTMLElement | null;
    if (tgt && (tgt as HTMLInputElement).selectionStart !== undefined) {
      tgt.focus();
      pasteIntoInput(tgt as HTMLInputElement | HTMLTextAreaElement, text);
    } else if (isEditable(tgt)) {
      (tgt as HTMLElement).focus();
      // Legacy fallback for contentEditable paste operation
      runLegacyExecCommand('insertText', text);
    }
    close();
  };

  const onUndo = () => {
    try {
      // Legacy fallback for undo operation (no modern API alternative)
      runLegacyExecCommand('undo');
    } catch {
      /* empty */
    }
    close();
  };
  const onRedo = () => {
    try {
      // Legacy fallback for redo operation (no modern API alternative)
      runLegacyExecCommand('redo');
    } catch {
      /* empty */
    }
    close();
  };
  const onSelectAll = () => {
    try {
      // Legacy fallback for select all operation (no modern API alternative)
      runLegacyExecCommand('selectAll');
    } catch {
      /* empty */
    }
    close();
  };

  const onMenuKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    const menu = menuRef.current;
    if (!menu) return;
    const items = Array.from(
      menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')
    );
    if (items.length === 0) return;

    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);
    const activeIndex = Math.max(0, currentIndex);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusMenuItem(activeIndex + 1);
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusMenuItem(activeIndex - 1);
      return;
    }

    if (e.key === 'Home') {
      e.preventDefault();
      focusMenuItem(0);
      return;
    }

    if (e.key === 'End') {
      e.preventDefault();
      focusMenuItem(items.length - 1);
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  };

  if (!visible) return null;

  return (
    <div
      ref={menuRef}
      role="menu"
      tabIndex={-1}
      aria-orientation="vertical"
      style={{
        position: 'fixed',
        left: (adjustedPos ?? pos).x,
        top: (adjustedPos ?? pos).y,
        zIndex: 99999,
      }}
      className="min-w-[160px] rounded-md border border-gray-300 bg-white text-gray-900 shadow-lg dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={onMenuKeyDown}
    >
      <MenuItem label="Copy" onClick={onCopy} />
      {canCut && <MenuItem label="Cut" onClick={onCut} />}
      {canPaste && <MenuItem label="Paste" onClick={onPaste} />}
      <Divider />
      <MenuItem label="Undo" onClick={onUndo} />
      <MenuItem label="Redo" onClick={onRedo} />
      <Divider />
      <MenuItem label="Select All" onClick={onSelectAll} />
    </div>
  );
};

const MenuItem: React.FC<{ label: string; onClick: () => void }> = ({
  label,
  onClick,
}) => (
  <button
    className="block w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
    onClick={onClick}
    type="button"
  >
    {label}
  </button>
);

const Divider: React.FC = () => (
  <div className="my-1 h-px bg-gray-200 dark:bg-gray-700" />
);
