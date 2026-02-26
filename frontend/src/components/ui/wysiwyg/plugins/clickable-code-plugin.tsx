import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';

interface ClickableCodePluginProps {
  /** Function to find a matching diff path (supports partial/right-hand match) */
  findMatchingDiffPath: (text: string) => string | null;
  /** Callback when a clickable code element is clicked (receives the full path) */
  onCodeClick: (fullPath: string) => void;
}

/**
 * Plugin that makes inline code elements clickable when their content
 * matches a file path in the current diffs.
 *
 * Supports fuzzy right-hand matching: "ChatMarkdown.tsx" will match
 * "src/components/ui-new/primitives/conversation/ChatMarkdown.tsx"
 *
 * Only active in read-only mode. Adds hover styling and click handlers
 * to matching code elements.
 */
export function ClickableCodePlugin({
  findMatchingDiffPath,
  onCodeClick,
}: Readonly<ClickableCodePluginProps>) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const root = editor.getRootElement();
    if (!root) return;
    const clickHandlers = new Map<HTMLElement, EventListener>();

    // Process a single code element
    const processCodeElement = (element: Element) => {
      const htmlElement = element as HTMLElement;

      // Remove previously attached listener before rebinding.
      const existingHandler = clickHandlers.get(htmlElement);
      if (existingHandler) {
        htmlElement.removeEventListener('click', existingHandler);
        clickHandlers.delete(htmlElement);
      }

      const text = element.textContent?.trim() ?? '';

      // Check if this matches a diff path (supports fuzzy right-hand match)
      const matchedPath = findMatchingDiffPath(text);
      if (!matchedPath) {
        htmlElement.style.cursor = '';
        htmlElement.classList.remove('clickable-code');
        delete htmlElement.dataset.clickableCode;
        return;
      }

      // Add clickable styling
      htmlElement.style.cursor = 'pointer';
      element.classList.add('clickable-code');

      // Add click handler - use the full matched path for navigation
      const handleClick: EventListener = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        onCodeClick(matchedPath);
      };

      htmlElement.addEventListener('click', handleClick);
      clickHandlers.set(htmlElement, handleClick);

      // Store cleanup function on the element
      htmlElement.dataset.clickableCode = 'true';
    };

    // Process all existing code elements
    const processAllCodeElements = () => {
      // Inline code uses the theme class which includes 'font-mono' and 'bg-muted'
      // The actual class applied is from theme.text.code
      const codeElements = root.querySelectorAll(
        'code, .font-mono.bg-muted, [class*="text-code"]'
      );
      codeElements.forEach(processCodeElement);
    };

    // Initial processing
    processAllCodeElements();

    // Watch for new code elements being added
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        // Check added nodes
        for (const node of mutation.addedNodes) {
          if (node instanceof Element) {
            // Check if the node itself is a code element
            if (
              node.matches('code, .font-mono.bg-muted, [class*="text-code"]')
            ) {
              processCodeElement(node);
            }
            // Check child code elements
            const childCodeElements = node.querySelectorAll(
              'code, .font-mono.bg-muted, [class*="text-code"]'
            );
            childCodeElements.forEach(processCodeElement);
          }
        }
      }
    });

    observer.observe(root, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
      // Clean up click handlers and element styles.
      clickHandlers.forEach((handler, element) => {
        element.removeEventListener('click', handler);
        element.style.cursor = '';
        element.classList.remove('clickable-code');
        delete element.dataset.clickableCode;
      });
      clickHandlers.clear();
    };
  }, [editor, findMatchingDiffPath, onCodeClick]);

  return null;
}
