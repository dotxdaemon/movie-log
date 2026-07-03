// ABOUTME: Configures the Electron app runtime before Movie Log creates any windows.
// ABOUTME: Keeps desktop startup behavior testable without importing the full main process into unit tests.
interface DesktopApp {
  disableHardwareAcceleration(): void;
  on(event: 'second-instance', listener: () => void): void;
  quit(): void;
  requestSingleInstanceLock(): boolean;
  setName(name: string): void;
}

interface AppRuntimeActions {
  showWindow(): void;
}

export function prepareAppRuntime(app: DesktopApp, actions: AppRuntimeActions): void {
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }

  app.setName('Movie Log');
  app.on('second-instance', actions.showWindow);
}
