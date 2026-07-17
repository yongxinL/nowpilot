import React, { useMemo } from 'react';
import { Tree, Typography, Empty } from 'antd';
import type { DataNode } from 'antd/es/tree';
import type { Note } from '../../core/notes/LinkParser';

const { Text } = Typography;

export interface CategoryTreeProps {
  notes: Note[];
  selectedNoteId: string | null;
  onSelect: (id: string) => void;
}

/**
 * Build a nested AntD Tree DataNode array from note categoryPath values.
 *
 * Algorithm:
 * 1. Separate categorized and uncategorized notes
 * 2. Build a path-based tree from categorized notes
 * 3. Merge children into their parent nodes by path prefix
 * 4. Append "Uncategorized" node if there are uncategorized notes
 */
function buildCategoryTreeData(notes: Note[]): DataNode[] {
  // Separate categorized and uncategorized notes
  const categorized = new Map<string, Note[]>();
  const uncategorized: Note[] = [];

  for (const note of notes) {
    if (note.categoryPath?.trim()) {
      const path = note.categoryPath.trim().replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/');
      if (path) {
        if (!categorized.has(path)) {
          categorized.set(path, []);
        }
        categorized.get(path)!.push(note);
      } else {
        uncategorized.push(note);
      }
    } else {
      uncategorized.push(note);
    }
  }

  // Build leaf nodes per category path
  const pathToNode = new Map<string, DataNode>();

  for (const [path, pathNotes] of categorized) {
    const segments = path.split('/');
    // Ensure all parent segments exist as folder nodes
    for (let i = 1; i <= segments.length; i++) {
      const prefix = segments.slice(0, i).join('/');
      if (!pathToNode.has(prefix)) {
        pathToNode.set(prefix, {
          key: `cat-folder:${prefix}`,
          title: segments[i - 1],
          children: [],
        });
      }
    }
    // Convert the leaf path node to a category node with note children
    const leafNode: DataNode = {
      key: `cat:${path}`,
      title: segments[segments.length - 1],
      children: pathNotes.map((n) => ({
        key: n.id,
        title: n.title,
        isLeaf: true,
      })),
    };
    pathToNode.set(path, leafNode);
  }

  // Nest children under parents by path prefix
  const topLevel: DataNode[] = [];

  for (const [path, node] of pathToNode) {
    const segments = path.split('/');
    if (segments.length === 1) {
      // Top-level category
      topLevel.push(node);
    } else {
      // Find or create parent node
      const parentPath = segments.slice(0, -1).join('/');
      const parentNode = pathToNode.get(parentPath);
      if (parentNode) {
        if (!parentNode.children) {
          parentNode.children = [];
        }
        // Replace the placeholder folder node with the actual category node
        const existingIdx = parentNode.children.findIndex(
          (c) => c.key === `cat-folder:${path}` || c.key === `cat:${path}`
        );
        if (existingIdx >= 0) {
          parentNode.children[existingIdx] = node;
        } else {
          parentNode.children.push(node);
        }
      } else {
        // Parent doesn't exist as a categorized path — make it a pure folder
        const folderNode: DataNode = {
          key: `cat-folder:${parentPath}`,
          title: segments[segments.length - 2],
          children: [node],
        };
        pathToNode.set(parentPath, folderNode);
        // Check if this folder is top-level
        if (segments.length === 2) {
          topLevel.push(folderNode);
        }
      }
    }
  }

  // Add Uncategorized node
  if (uncategorized.length > 0) {
    topLevel.push({
      key: '__uncategorized__',
      title: 'Uncategorized',
      children: uncategorized.map((n) => ({
        key: n.id,
        title: n.title,
        isLeaf: true,
      })),
    });
  }

  return topLevel;
}

export function CategoryTree({ notes, selectedNoteId, onSelect }: CategoryTreeProps) {
  const treeData = useMemo(() => buildCategoryTreeData(notes), [notes]);

  if (notes.length === 0) {
    return (
      <div style={{ padding: '16px 8px' }}>
        <Text type="secondary" strong style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
          Categories
        </Text>
        <Empty
          description="No notes"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          style={{ margin: 0 }}
        />
      </div>
    );
  }

  return (
    <div style={{ padding: '8px' }}>
      <Text type="secondary" strong style={{ fontSize: 12, display: 'block', marginBottom: 8, paddingLeft: 4 }}>
        Categories
      </Text>
      <Tree
        treeData={treeData}
        showIcon
        defaultExpandAll
        onSelect={(keys) => {
          if (keys.length > 0 && typeof keys[0] === 'string' && !keys[0].startsWith('cat:')) {
            onSelect(keys[0] as string);
          }
        }}
        selectedKeys={selectedNoteId ? [selectedNoteId] : []}
      />
    </div>
  );
}
