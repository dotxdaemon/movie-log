// ABOUTME: Verifies that Movie Log creates a macOS menu bar item with the expected actions.
// ABOUTME: Keeps the top-bar entry testable without importing the full Electron runtime into unit tests.
import { describe, expect, it, vi } from 'vitest';
import { createStatusItem } from '../electron/status-item.js';

describe('createStatusItem', () => {
  it('creates a clickable menu bar item for showing and quitting Movie Log', () => {
    const image = {
      resize: vi.fn(() => image),
      setTemplateImage: vi.fn()
    };
    const createFromDataURL = vi.fn(() => image);
    const setContextMenu = vi.fn();
    const setTitle = vi.fn();
    const setToolTip = vi.fn();
    const on = vi.fn();
    const tray = {
      on,
      setContextMenu,
      setTitle,
      setToolTip
    };
    class TrayConstructor {
      constructor() {
        return tray;
      }
    }
    const buildFromTemplate = vi.fn((template) => template);
    const showWindow = vi.fn();
    const quitApp = vi.fn();

    const createdTray = createStatusItem({
      TrayConstructor: TrayConstructor as never,
      imageFactory: {
        createFromDataURL
      },
      menu: {
        buildFromTemplate
      },
      quitApp,
      showWindow
    });

    expect(createFromDataURL).toHaveBeenCalledTimes(1);
    expect(image.resize).toHaveBeenCalledWith({ height: 18 });
    expect(image.setTemplateImage).toHaveBeenCalledWith(true);
    expect(setToolTip).toHaveBeenCalledWith('Movie Log');
    expect(setTitle).toHaveBeenCalledWith('ML');
    expect(buildFromTemplate).toHaveBeenCalledTimes(1);
    expect(buildFromTemplate.mock.calls[0][0].map((item: { label?: string; type?: string }) => item.label ?? item.type)).toEqual([
      'Show Movie Log',
      'separator',
      'Quit Movie Log'
    ]);

    buildFromTemplate.mock.calls[0][0][0].click();
    buildFromTemplate.mock.calls[0][0][2].click();

    expect(showWindow).toHaveBeenCalledTimes(1);
    expect(quitApp).toHaveBeenCalledTimes(1);
    expect(setContextMenu).toHaveBeenCalledWith(buildFromTemplate.mock.results[0].value);
    expect(on).toHaveBeenCalledWith('click', expect.any(Function));

    const clickHandler = on.mock.calls[0][1];
    clickHandler();

    expect(showWindow).toHaveBeenCalledTimes(2);
    expect(createdTray).toBe(tray);
  });
});
