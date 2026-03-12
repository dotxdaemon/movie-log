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
    '<defs>',
    '<mask id="ticket-cutout">',
    '<rect width="18" height="18" fill="#000000"/>',
    '<rect x="2.5" y="4" width="13" height="10" rx="2.2" fill="#ffffff"/>',
    '<circle cx="2.5" cy="9" r="1.3" fill="#000000"/>',
    '<circle cx="15.5" cy="9" r="1.3" fill="#000000"/>',
    '<rect x="7.4" y="6.2" width="3.2" height="5.6" rx="0.8" fill="#000000"/>',
    '</mask>',
    '</defs>',
    '<rect width="18" height="18" fill="#000000" mask="url(#ticket-cutout)"/>',
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
  tray.setContextMenu(menu);
  tray.on('click', options.showWindow);

  return tray;
}
