// ABOUTME: Resolves simple React element trees so renderer structure can be tested without string snapshots.
// ABOUTME: Invokes pure function components and exposes class/text queries for renderer contract tests.
import { isValidElement, type ReactNode } from 'react';

interface TreeNode {
  children: TreeNode[];
  className: string;
  props: Record<string, unknown>;
  text: string;
  type: string;
}

function normalizeChildren(value: ReactNode): TreeNode[] {
  if (value === null || value === undefined || typeof value === 'boolean') {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => normalizeChildren(item));
  }

  if (typeof value === 'string' || typeof value === 'number') {
    return [
      {
        children: [],
        className: '',
        props: {},
        text: String(value),
        type: '#text'
      }
    ];
  }

  if (!isValidElement(value)) {
    return [];
  }

  if (typeof value.type === 'function') {
    const component = value.type as (props: Record<string, unknown>) => ReactNode;
    return normalizeChildren(component((value.props ?? {}) as Record<string, unknown>));
  }

  const props = (value.props ?? {}) as Record<string, unknown>;
  const children = normalizeChildren((props.children ?? null) as ReactNode);
  return [
    {
      children,
      className: typeof props.className === 'string' ? props.className : '',
      props,
      text: children.map((child) => child.text).join(''),
      type: String(value.type)
    }
  ];
}

function walk(nodes: TreeNode[], visit: (node: TreeNode) => void): void {
  for (const node of nodes) {
    visit(node);
    walk(node.children, visit);
  }
}

export function renderTree(node: ReactNode): TreeNode[] {
  return normalizeChildren(node);
}

export function findByClass(nodes: TreeNode[], className: string): TreeNode[] {
  const matches: TreeNode[] = [];
  walk(nodes, (node) => {
    const classes = node.className.split(/\s+/).filter(Boolean);
    if (classes.includes(className)) {
      matches.push(node);
    }
  });
  return matches;
}

export function readText(nodes: TreeNode[]): string {
  return nodes.map((node) => node.text).join(' ');
}
