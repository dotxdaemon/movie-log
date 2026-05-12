// ABOUTME: Reveals the Movie Log window without forcing macOS to switch displays or spaces.
// ABOUTME: Keeps reopen behavior isolated so the main process can preserve placement without direct focus calls.
interface WindowBounds {
  height: number;
  width: number;
  x: number;
  y: number;
}

interface WindowToReveal {
  focus(): void;
  getBounds(): WindowBounds;
  isMinimized(): boolean;
  restore(): void;
  setBounds(bounds: WindowBounds): void;
  showInactive(): void;
}

function moveWindowIntoArea(windowBounds: WindowBounds, areaBounds: WindowBounds): WindowBounds {
  const width = Math.min(windowBounds.width, areaBounds.width);
  const height = Math.min(windowBounds.height, areaBounds.height);
  const x = areaBounds.x + Math.round((areaBounds.width - width) / 2);
  const y = areaBounds.y + Math.round((areaBounds.height - height) / 2);

  return {
    height,
    width,
    x,
    y
  };
}

export function revealWindow(windowToReveal: WindowToReveal, areaBounds: WindowBounds): void {
  if (windowToReveal.isMinimized()) {
    windowToReveal.restore();
  }

  windowToReveal.setBounds(moveWindowIntoArea(windowToReveal.getBounds(), areaBounds));
  windowToReveal.showInactive();
}
