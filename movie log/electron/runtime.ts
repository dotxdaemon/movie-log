// ABOUTME: Configures the Electron app runtime before Movie Log creates any windows.
// ABOUTME: Keeps desktop startup behavior testable without importing the full main process into unit tests.
interface DesktopApp {
  disableHardwareAcceleration(): void;
  quit(): void;
  requestSingleInstanceLock(): boolean;
  setName(name: string): void;
}

export function prepareAppRuntime(app: DesktopApp): void {
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }

  app.disableHardwareAcceleration();
  app.setName('Movie Log');
}
