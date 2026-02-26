import type { Diff } from 'shared/types';
import type { TreeNode } from '@/components/ui-new/types/fileTree';

// Helper to create a tree node
function createTreeNode(
  path: string,
  name: string,
  isFile: boolean,
  diff?: Diff
): TreeNode {
  const node: TreeNode = {
    id: path,
    name,
    path,
    type: isFile ? 'file' : 'folder',
    children: isFile ? undefined : [],
  };

  if (isFile && diff) {
    node.diff = diff;
    node.changeKind = diff.change;
    node.additions = diff.additions;
    node.deletions = diff.deletions;
  }

  return node;
}

// Helper to build child map from existing children
function buildChildMap(children: TreeNode[]): Map<string, TreeNode> {
  const childMap = new Map<string, TreeNode>();
  for (const child of children) {
    childMap.set(child.name, child);
  }
  return childMap;
}

// Helper to process next level in tree
function processNextLevel(
  node: TreeNode,
  parts: string[],
  currentIndex: number,
  diff: Diff
): Map<string, TreeNode> {
  if (!node.children) {
    return new Map();
  }

  const childMap = buildChildMap(node.children);
  const nextIndex = currentIndex + 1;

  if (nextIndex < parts.length) {
    const nextPart = parts[nextIndex];
    const nextPath = parts.slice(0, nextIndex + 1).join('/');
    const nextIsFile = nextIndex === parts.length - 1;

    if (!childMap.has(nextPart)) {
      const nextNode = createTreeNode(nextPath, nextPart, nextIsFile, nextIsFile ? diff : undefined);
      childMap.set(nextPart, nextNode);
      node.children.push(nextNode);
    }
  }

  return childMap;
}

// Helper to ensure a node exists in the map and return the updated map for traversal
function ensureNodeAndDescend(
  currentMap: Map<string, TreeNode>,
  parts: string[],
  index: number,
  diff: Diff
): Map<string, TreeNode> {
  const part = parts[index];
  const isFile = index === parts.length - 1;
  const currentPath = parts.slice(0, index + 1).join('/');

  if (!currentMap.has(part)) {
    const node = createTreeNode(currentPath, part, isFile, isFile ? diff : undefined);
    currentMap.set(part, node);
  }

  const node = currentMap.get(part)!;

  if (!isFile && node.children) {
    return processNextLevel(node, parts, index, diff);
  }
  return currentMap;
}

/**
 * Transforms flat Diff[] into hierarchical TreeNode[]
 */
export function buildFileTree(diffs: Diff[]): TreeNode[] {
  const rootMap = new Map<string, TreeNode>();

  for (const diff of diffs) {
    const filePath = diff.newPath ?? diff.oldPath;
    if (!filePath) continue;

    const parts = filePath.split('/');
    let currentMap = rootMap;

    for (let i = 0; i < parts.length; i++) {
      currentMap = ensureNodeAndDescend(currentMap, parts, i, diff);
    }
  }

  return sortTreeNodes(Array.from(rootMap.values()));
}

/**
 * Sort nodes: folders first, then alphabetically
 */
function sortTreeNodes(nodes: TreeNode[]): TreeNode[] {
  return nodes
    .map((node) => ({
      ...node,
      children: node.children ? sortTreeNodes(node.children) : undefined,
    }))
    .sort((a, b) => {
      // Folders before files
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1;
      }
      // Alphabetical within same type
      return a.name.localeCompare(b.name);
    });
}

/**
 * Filter tree based on search query only
 */
export function filterFileTree(
  nodes: TreeNode[],
  searchQuery: string
): TreeNode[] {
  if (!searchQuery) {
    return nodes;
  }

  const query = searchQuery.toLowerCase();

  function filterNode(node: TreeNode): TreeNode | null {
    // For folders, recursively filter children
    if (node.type === 'folder' && node.children) {
      const filteredChildren = node.children
        .map(filterNode)
        .filter((n): n is TreeNode => n !== null);

      if (filteredChildren.length === 0) {
        return null;
      }

      return { ...node, children: filteredChildren };
    }

    // For files, check search query
    if (node.type === 'file') {
      if (node.path.toLowerCase().includes(query)) {
        return node;
      }
    }

    return null;
  }

  return nodes.map(filterNode).filter((n): n is TreeNode => n !== null);
}

/**
 * Get all folder paths that should be expanded to show matching files
 */
export function getExpandedPathsForSearch(
  nodes: TreeNode[],
  searchQuery: string
): Set<string> {
  const paths = new Set<string>();
  const query = searchQuery.toLowerCase();

  function traverse(node: TreeNode, parentPaths: string[]) {
    if (node.type === 'file' && node.path.toLowerCase().includes(query)) {
      // Add all parent folder paths
      parentPaths.forEach((p) => paths.add(p));
    }

    if (node.children) {
      const currentPaths = [...parentPaths, node.path];
      node.children.forEach((child) => traverse(child, currentPaths));
    }
  }

  nodes.forEach((node) => traverse(node, []));
  return paths;
}

/**
 * Get all folder paths in the tree
 */
export function getAllFolderPaths(nodes: TreeNode[]): string[] {
  const paths: string[] = [];

  function traverse(node: TreeNode) {
    if (node.type === 'folder') {
      paths.push(node.path);
      node.children?.forEach(traverse);
    }
  }

  nodes.forEach(traverse);
  return paths;
}

/**
 * Sort diffs to match FileTree ordering: folders before files at each level,
 * then alphabetically within each group
 */
export function sortDiffs(diffs: Diff[]): Diff[] {
  return [...diffs].sort((a, b) => {
    const pathA = a.newPath || a.oldPath || '';
    const pathB = b.newPath || b.oldPath || '';

    const partsA = pathA.split('/');
    const partsB = pathB.split('/');

    const minLength = Math.min(partsA.length, partsB.length);

    for (let i = 0; i < minLength; i++) {
      const isLastA = i === partsA.length - 1;
      const isLastB = i === partsB.length - 1;

      // If one is a file (last segment) and other is a folder (not last), folder comes first
      if (isLastA !== isLastB) {
        return isLastA ? 1 : -1;
      }

      // Same type at this level, compare alphabetically
      const cmp = partsA[i].localeCompare(partsB[i]);
      if (cmp !== 0) return cmp;
    }

    // Shorter path (folder) comes before longer path (nested file)
    return partsA.length - partsB.length;
  });
}
