// ABOUTME: Creates the macOS menu bar item that reopens Movie Log and exposes quit actions.
// ABOUTME: Keeps the status item wiring testable without importing the full Electron runtime into every test.
interface StatusImage<TImage> {
  resize(options: { height: number }): TImage;
  setTemplateImage(option: boolean): void;
}

interface StatusImageFactory<TImage> {
  createFromDataURL(dataUrl: string): TImage;
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

function createStatusIconMarkup(): string {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" role="img" aria-hidden="true">',
    '<path fill="#000000" d="M2.5 3.2h2.1l2.1 4.6 2.1-4.6h2.1v11.1H9.2V7.9l-1.7 3.6H5.9L4.2 7.9v6.4H2.5V3.2Z"/>',
    '<path fill="#000000" d="m11.8 3.5 3.7 2.2-3.7 2.2Z"/>',
    '</svg>'
  ].join('');
}

function createStatusIconDataUrl(): string {
  const encodedMarkup = Buffer.from(createStatusIconMarkup(), 'utf8').toString('base64');
  return `data:image/svg+xml;base64,${encodedMarkup}`;
}

export function createStatusItem<TTray extends StatusTray, TImage extends StatusImage<TImage>>(
  options: StatusItemActions & {
    TrayConstructor: StatusTrayFactory<TTray, TImage>;
    imageFactory: StatusImageFactory<TImage>;
  }
): TTray {
  const icon = options.imageFactory.createFromDataURL(createStatusIconDataUrl()).resize({ height: 18 });
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
  tray.setTitle?.('ML');
  tray.setContextMenu(menu);
  tray.on('click', options.showWindow);

  return tray;
}
