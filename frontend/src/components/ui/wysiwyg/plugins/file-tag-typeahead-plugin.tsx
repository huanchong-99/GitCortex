import { useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
} from '@lexical/react/LexicalTypeaheadMenuPlugin';
import {
  $createTextNode,
  $getRoot,
  $createParagraphNode,
  $isParagraphNode,
} from 'lexical';
import { Tag as TagIcon, FileText } from 'lucide-react';
import { usePortalContainer } from '@/contexts/PortalContainerContext';
import {
  searchTagsAndFiles,
  type SearchResultItem,
} from '@/lib/searchTagsAndFiles';

class FileTagOption extends MenuOption {
  item: SearchResultItem;

  constructor(item: SearchResultItem) {
    const key =
      item.type === 'tag' ? `tag-${item.tag!.id}` : `file-${item.file!.path}`;
    super(key);
    this.item = item;
  }
}

const VIEWPORT_MARGIN = 8;
const VERTICAL_GAP = 4;
const VERTICAL_GAP_ABOVE = 24;
const MIN_WIDTH = 320;

// Helper to handle mouse move with position tracking
function createMouseMoveHandler(
  lastMousePositionRef: React.MutableRefObject<{ x: number; y: number } | null>,
  setHighlightedIndex: (index: number) => void,
  index: number
) {
  return (e: React.MouseEvent) => {
    const pos = { x: e.clientX, y: e.clientY };
    const last = lastMousePositionRef.current;
    if (!last || last.x !== pos.x || last.y !== pos.y) {
      lastMousePositionRef.current = pos;
      setHighlightedIndex(index);
    }
  };
}

// Helper to get item class names based on selection state
function getItemClassName(isSelected: boolean): string {
  return `px-3 py-2 cursor-pointer text-sm border-l-2 ${
    isSelected
      ? 'bg-muted bg-secondary border-l-brand text-high'
      : 'hover:bg-muted border-l-transparent text-muted-foreground'
  }`;
}

function getMenuPosition(anchorEl: HTMLElement) {
  const rect = anchorEl.getBoundingClientRect();
  const viewportHeight = globalThis.window.innerHeight;
  const viewportWidth = globalThis.window.innerWidth;

  const spaceAbove = rect.top;
  const spaceBelow = viewportHeight - rect.bottom;

  const showBelow = spaceBelow >= spaceAbove;

  let top: number | undefined;
  let bottom: number | undefined;

  if (showBelow) {
    top = rect.bottom + VERTICAL_GAP;
  } else {
    bottom = viewportHeight - rect.top + VERTICAL_GAP_ABOVE;
  }

  let left = rect.left;
  const maxLeft = viewportWidth - MIN_WIDTH - VIEWPORT_MARGIN;
  if (left > maxLeft) {
    left = Math.max(VIEWPORT_MARGIN, maxLeft);
  }

  return { top, bottom, left };
}

function handleTagSelection(
  option: FileTagOption,
  nodeToReplace: ReturnType<typeof $createTextNode>
) {
  const textToInsert = option.item.tag?.content ?? '';
  const textNode = $createTextNode(textToInsert);
  nodeToReplace.replace(textNode);
  textNode.select(textToInsert.length, textToInsert.length);
}

function checkPathExists(fullPath: string): boolean {
  const root = $getRoot();
  const children = root.getChildren();

  for (const child of children) {
    if (!$isParagraphNode(child)) continue;

    const textNodes = child.getAllTextNodes();
    for (const textNode of textNodes) {
      if (
        textNode.hasFormat('code') &&
        textNode.getTextContent() === fullPath
      ) {
        return true;
      }
    }
  }

  return false;
}

function appendPathToBottom(fullPath: string) {
  if (!fullPath) return;

  const root = $getRoot();
  const pathParagraph = $createParagraphNode();
  const pathNode = $createTextNode(fullPath);
  pathNode.toggleFormat('code');
  pathParagraph.append(pathNode);
  root.append(pathParagraph);
}

// Component to render a tag menu item
function TagMenuItem({
  option,
  index,
  selectedIndex,
  lastMousePositionRef,
  setHighlightedIndex,
  selectOptionAndCleanUp,
}: Readonly<{
  option: FileTagOption;
  index: number;
  selectedIndex: number;
  lastMousePositionRef: React.MutableRefObject<{ x: number; y: number } | null>;
  setHighlightedIndex: (index: number) => void;
  selectOptionAndCleanUp: (option: FileTagOption) => void;
}>) {
  const tag = option.item.tag!;
  const isSelected = index === selectedIndex;

  return (
    <div
      key={option.key}
      role="option"
      aria-selected={isSelected}
      tabIndex={-1}
      className={getItemClassName(isSelected)}
      onMouseMove={createMouseMoveHandler(lastMousePositionRef, setHighlightedIndex, index)}
      onClick={() => selectOptionAndCleanUp(option)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectOptionAndCleanUp(option); } }}
    >
      <div className="flex items-center gap-2 font-medium">
        <TagIcon className="h-3.5 w-3.5 text-blue-600" />
        <span>@{tag.tagName}</span>
      </div>
      {tag.content && (
        <div className="text-xs mt-0.5 truncate">
          {tag.content.slice(0, 60)}
          {tag.content.length > 60 ? '...' : ''}
        </div>
      )}
    </div>
  );
}

// Component to render a file menu item
function FileMenuItem({
  option,
  index,
  selectedIndex,
  lastMousePositionRef,
  setHighlightedIndex,
  selectOptionAndCleanUp,
}: Readonly<{
  option: FileTagOption;
  index: number;
  selectedIndex: number;
  lastMousePositionRef: React.MutableRefObject<{ x: number; y: number } | null>;
  setHighlightedIndex: (index: number) => void;
  selectOptionAndCleanUp: (option: FileTagOption) => void;
}>) {
  const file = option.item.file!;
  const isSelected = index === selectedIndex;

  return (
    <div
      key={option.key}
      role="option"
      aria-selected={isSelected}
      tabIndex={-1}
      className={getItemClassName(isSelected)}
      onMouseMove={createMouseMoveHandler(lastMousePositionRef, setHighlightedIndex, index)}
      onClick={() => selectOptionAndCleanUp(option)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectOptionAndCleanUp(option); } }}
    >
      <div className="flex items-center gap-2 font-medium truncate">
        <FileText className="h-3.5 w-3.5 flex-shrink-0" />
        <span>{file.name}</span>
      </div>
      <div className="text-xs truncate">{file.path}</div>
    </div>
  );
}

function handleFileSelection(
  option: FileTagOption,
  nodeToReplace: ReturnType<typeof $createTextNode>
) {
  const fileName = option.item.file?.name ?? '';
  const fullPath = option.item.file?.path ?? '';

  // Insert filename as inline code at cursor position
  const fileNameNode = $createTextNode(fileName);
  fileNameNode.toggleFormat('code');
  nodeToReplace.replace(fileNameNode);

  // Add a space after the inline code for better UX
  const spaceNode = $createTextNode(' ');
  fileNameNode.insertAfter(spaceNode);
  spaceNode.select(1, 1);

  // Check if full path already exists and append if not
  const pathAlreadyExists = checkPathExists(fullPath);
  if (!pathAlreadyExists) {
    appendPathToBottom(fullPath);
  }
}

export function FileTagTypeaheadPlugin({
  workspaceId,
  projectId,
}: Readonly<{
  workspaceId?: string;
  projectId?: string;
}>) {
  const [editor] = useLexicalComposerContext();
  const [options, setOptions] = useState<FileTagOption[]>([]);
  const lastMousePositionRef = useRef<{ x: number; y: number } | null>(null);
  const portalContainer = usePortalContainer();

  const onQueryChange = useCallback(
    (query: string | null) => {
      // Lexical uses null to indicate "no active query / close menu"
      if (query === null) {
        setOptions([]);
        return;
      }

      // Here query is a string, including possible empty string ''
      searchTagsAndFiles(query, { workspaceId, projectId })
        .then((results) => {
          setOptions(results.map((r) => new FileTagOption(r)));
        })
        .catch((err) => {
          console.error('Failed to search tags/files', err);
        });
    },
    [workspaceId, projectId]
  );

  return (
    <LexicalTypeaheadMenuPlugin<FileTagOption>
      triggerFn={(text) => {
        // Match @ followed by any non-whitespace characters
        const match = /(?:^|\s)@([^\s@]*)$/.exec(text);
        if (!match) return null;
        const offset = match.index + match[0].indexOf('@');
        return {
          leadOffset: offset,
          matchingString: match[1],
          replaceableString: match[0].slice(match[0].indexOf('@')),
        };
      }}
      options={options}
      onQueryChange={onQueryChange}
      onSelectOption={(option, nodeToReplace, closeMenu) => {
        editor.update(() => {
          if (!nodeToReplace) return;

          if (option.item.type === 'tag') {
            handleTagSelection(option, nodeToReplace);
          } else {
            handleFileSelection(option, nodeToReplace);
          }
        });

        closeMenu();
      }}
      menuRenderFn={(
        anchorRef,
        { selectedIndex, selectOptionAndCleanUp, setHighlightedIndex }
      ) => {
        if (!anchorRef.current) return null;

        const { top, bottom, left } = getMenuPosition(anchorRef.current);

        const tagResults = options.filter((r) => r.item.type === 'tag');
        const fileResults = options.filter((r) => r.item.type === 'file');

        return createPortal(
          <div
            className="fixed bg-background border border-border rounded-md shadow-lg"
            style={{
              top,
              bottom,
              left,
              minWidth: MIN_WIDTH,
              zIndex: 10000,
            }}
          >
            {options.length === 0 ? (
              <div className="p-2 text-sm text-muted-foreground">
                No tags or files found
              </div>
            ) : (
              <div className="py-1">
                {/* Tags Section */}
                {tagResults.length > 0 && (
                  <>
                    <div className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase">
                      Tags
                    </div>
                    {tagResults.map((option) => (
                      <TagMenuItem
                        key={option.key}
                        option={option}
                        index={options.indexOf(option)}
                        selectedIndex={selectedIndex ?? 0}
                        lastMousePositionRef={lastMousePositionRef}
                        setHighlightedIndex={setHighlightedIndex}
                        selectOptionAndCleanUp={selectOptionAndCleanUp}
                      />
                    ))}
                  </>
                )}

                {/* Files Section */}
                {fileResults.length > 0 && (
                  <>
                    {tagResults.length > 0 && <div className="border-t my-1" />}
                    <div className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase">
                      Files
                    </div>
                    {fileResults.map((option) => (
                      <FileMenuItem
                        key={option.key}
                        option={option}
                        index={options.indexOf(option)}
                        selectedIndex={selectedIndex ?? 0}
                        lastMousePositionRef={lastMousePositionRef}
                        setHighlightedIndex={setHighlightedIndex}
                        selectOptionAndCleanUp={selectOptionAndCleanUp}
                      />
                    ))}
                  </>
                )}
              </div>
            )}
          </div>,
          portalContainer ?? document.body
        );
      }}
    />
  );
}
