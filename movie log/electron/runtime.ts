// ABOUTME: Configures the Electron app runtime before Movie Log creates any windows.
// ABOUTME: Keeps desktop startup behavior testable without importing the full main process into unit tests.
interface DesktopApp {
  disableHardwareAcceleration(): void;
  setName(name: string): void;
}

export function prepareAppRuntime(app: DesktopApp): void {
  app.disableHardwareAcceleration();
  app.setName('Movie Log');
}
