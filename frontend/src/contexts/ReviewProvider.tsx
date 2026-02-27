import { SplitSide } from '@git-diff-view/react';
import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { genId } from '@/utils/id';

export interface ReviewComment {
  id: string;
  filePath: string;
  lineNumber: number;
  side: SplitSide;
  text: string;
  codeLine?: string;
}

export interface ReviewDraft {
  filePath: string;
  side: SplitSide;
  lineNumber: number;
  text: string;
  codeLine?: string;
}

interface ReviewContextType {
  comments: ReviewComment[];
  drafts: Record<string, ReviewDraft>;
  addComment: (comment: Omit<ReviewComment, 'id'>) => void;
  updateComment: (id: string, text: string) => void;
  deleteComment: (id: string) => void;
  clearComments: () => void;
  setDraft: (key: string, draft: ReviewDraft | null) => void;
  generateReviewMarkdown: () => string;
}

const ReviewContext = createContext<ReviewContextType | null>(null);

export function useReview() {
  const context = useContext(ReviewContext);
  if (!context) {
    throw new Error('useReview must be used within a ReviewProvider');
  }
  return context;
}

/**
 * Optional version of useReview that returns null if not inside a ReviewProvider.
 * Useful for components that may or may not be inside a review context.
 */
export function useReviewOptional() {
  return useContext(ReviewContext);
}

const isAsciiLetterOrDigit = (char: string): boolean => {
  const code = char.charCodeAt(0);
  return (
    (code >= 48 && code <= 57) ||
    (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122)
  );
};

const isPathSeparator = (char: string): boolean => char === '/' || char === '\\';

const isPathSegmentChar = (char: string): boolean =>
  isAsciiLetterOrDigit(char) || char === '_' || char === '.' || char === '-';

const isPathTokenChar = (char: string): boolean =>
  isPathSeparator(char) || isPathSegmentChar(char);

const isFormattablePathToken = (token: string): boolean => {
  if (!token) {
    return false;
  }

  let index = 0;
  if (isPathSeparator(token[index])) {
    index++;
  }

  if (index >= token.length) {
    return false;
  }

  let hasSeparator = false;
  let segmentLength = 0;

  for (; index < token.length; index++) {
    const char = token[index];
    if (isPathSeparator(char)) {
      if (segmentLength === 0) {
        return false;
      }
      hasSeparator = true;
      segmentLength = 0;
      continue;
    }

    if (!isPathSegmentChar(char)) {
      return false;
    }

    segmentLength++;
  }

  return hasSeparator && segmentLength > 0;
};

const formatFilePathsWithBackticks = (text: string): string => {
  let result = '';
  let index = 0;

  while (index < text.length) {
    const char = text[index];
    if (!isPathTokenChar(char)) {
      result += char;
      index++;
      continue;
    }

    const start = index;
    while (index < text.length && isPathTokenChar(text[index])) {
      index++;
    }

    const token = text.slice(start, index);
    result += isFormattablePathToken(token) ? `\`${token}\`` : token;
  }

  return result;
};

export function ReviewProvider({
  children,
  attemptId,
}: Readonly<{
  children: ReactNode;
  attemptId?: string;
}>) {
  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ReviewDraft>>({});

  useEffect(() => {
    return () => clearComments();
  }, [attemptId]);

  const addComment = (comment: Omit<ReviewComment, 'id'>) => {
    const newComment: ReviewComment = {
      ...comment,
      id: genId(),
    };
    setComments((prev) => [...prev, newComment]);
  };

  const updateComment = (id: string, text: string) => {
    setComments((prev) =>
      prev.map((comment) =>
        comment.id === id ? { ...comment, text } : comment
      )
    );
  };

  const deleteComment = (id: string) => {
    setComments((prev) => prev.filter((comment) => comment.id !== id));
  };

  const clearComments = () => {
    setComments([]);
    setDrafts({});
  };

  const setDraft = (key: string, draft: ReviewDraft | null) => {
    setDrafts((prev) => {
      if (draft === null) {
        const newDrafts = { ...prev };
        delete newDrafts[key];
        return newDrafts;
      }
      return { ...prev, [key]: draft };
    });
  };

  const generateReviewMarkdown = useCallback(() => {
    if (comments.length === 0) return '';

    const commentsNum = comments.length;

    const header = `## Review Comments (${commentsNum})\n\n`;
    const formatCodeLine = (line?: string) => {
      if (!line) return '';
      if (line.includes('`')) {
        return `\`\`\`\n${line}\n\`\`\``;
      }
      return `\`${line}\``;
    };

    const commentsMd = comments
      .map((comment) => {
        const codeLine = formatCodeLine(comment.codeLine);
        // Format file paths in comment body with backticks
        const bodyWithFormattedPaths = formatFilePathsWithBackticks(
          comment.text.trim()
        );
        if (codeLine) {
          return `**${comment.filePath}** (Line ${comment.lineNumber})\n${codeLine}\n\n> ${bodyWithFormattedPaths}\n`;
        }
        return `**${comment.filePath}** (Line ${comment.lineNumber})\n\n> ${bodyWithFormattedPaths}\n`;
      })
      .join('\n');

    return header + commentsMd;
  }, [comments]);

  const contextValue = useMemo(
    () => ({
      comments,
      drafts,
      addComment,
      updateComment,
      deleteComment,
      clearComments,
      setDraft,
      generateReviewMarkdown,
    }),
    [comments, drafts, generateReviewMarkdown]
  );

  return (
    <ReviewContext.Provider value={contextValue}>
      {children}
    </ReviewContext.Provider>
  );
}
