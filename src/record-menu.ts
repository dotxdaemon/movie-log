// ABOUTME: Closes record action menus after use so open menus never linger over the ledger.
// ABOUTME: Works on plain DOM handles so menu behavior stays testable outside a browser.
interface OpenMenu {
  removeAttribute(name: string): void;
}

interface ActionElement {
  closest(selector: string): OpenMenu | null;
}

export function closeRecordMenuFromAction(actionElement: ActionElement): void {
  actionElement.closest('details.record-menu')?.removeAttribute('open');
}

interface WorkspaceRoot {
  querySelectorAll(selector: string): ArrayLike<OpenMenu & { contains(node: unknown): boolean }>;
}

export function closeRecordMenusOutside(root: WorkspaceRoot, target: unknown): void {
  const openMenus = root.querySelectorAll('details.record-menu[open]');

  for (let index = 0; index < openMenus.length; index += 1) {
    const menu = openMenus[index];

    if (!menu.contains(target)) {
      menu.removeAttribute('open');
    }
  }
}
