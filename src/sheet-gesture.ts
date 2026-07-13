// ABOUTME: Defines the downward movement that dismisses a mobile archive sheet.
// ABOUTME: Shares one deliberate threshold between the filter and logging surfaces.
const sheetDismissDistance = 72;

export function shouldDismissSheet(startY: number, endY: number): boolean {
  return endY - startY >= sheetDismissDistance;
}
