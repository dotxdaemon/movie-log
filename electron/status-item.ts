// ABOUTME: Creates the macOS menu bar item that reopens Movie Log and exposes quit actions.
// ABOUTME: Keeps the status item wiring testable without importing the full Electron runtime into every test.
interface StatusImage<TImage> {
  resize(options: { height: number; width: number }): TImage;
  setTemplateImage(option: boolean): void;
}

interface StatusImageFactory<TImage> {
  createFromNamedImage(imageName: string): TImage;
}

interface StatusTray {
  on(event: 'click', listener: () => void): void;
  setContextMenu(menu: unknown): void;
  setTitle?(title: string): void;
  setToolTip(toolTip: string): void;
}

interface StatusTrayFactory<TTray, TImage> {
  new (image: TImage): TTray;
}

interface StatusMenuTemplateItem {
  click?: () => void;
  label?: string;
  type?: 'separator';
}

interface StatusMenu {
  buildFromTemplate(template: StatusMenuTemplateItem[]): unknown;
}

interface StatusItemActions {
  menu: StatusMenu;
  quitApp: () => void;
  showWindow: () => void;
}

export function createStatusItem<TTray extends StatusTray, TImage extends StatusImage<TImage>>(
  options: StatusItemActions & {
    TrayConstructor: StatusTrayFactory<TTray, TImage>;
    imageFactory: StatusImageFactory<TImage>;
  }
): TTray {
  const icon = options.imageFactory.createFromNamedImage('ticket.fill').resize({ height: 18, width: 18 });
  icon.setTemplateImage(true);

  const tray = new options.TrayConstructor(icon);
  const menu = options.menu.buildFromTemplate([
    {
      label: 'Show Movie Log',
      click: options.showWindow
    },
    {
      type: 'separator'
    },
    {
      label: 'Quit Movie Log',
      click: options.quitApp
    }
  ]);

  tray.setToolTip('Movie Log');
  tray.setContextMenu(menu);
  tray.on('click', options.showWindow);

  return tray;
}
