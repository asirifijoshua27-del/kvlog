// Projector and stage-display windows.
// The main window publishes an OutputSnapshot whenever the live slide changes; this manager
// keeps the latest one and forwards it to every open output window, so all screens agree.
import { BrowserWindow, screen, type Display, type WebPreferences } from 'electron';
import type { DisplayAssignment, OutputRole, OutputSnapshot, OutputsStatus, RoleStatus } from '../shared/output-types';
import { getAssignment, setAssignment } from './settings';

const ROLES: OutputRole[] = ['projector', 'stage'];
const TITLES: Record<OutputRole, string> = { projector: 'KVLOG Projector', stage: 'KVLOG Stage Display' };
const MAX_SNAPSHOT_CHARS = 2_000_000;

interface OutputManagerDeps {
  webPreferences: WebPreferences;
  load: (win: BrowserWindow, role: OutputRole) => void;
  mainWindow: () => BrowserWindow | null;
}

function displayLabel(display: Display, index: number): string {
  return display.label && display.label.trim() ? display.label : `Display ${index + 1}`;
}

/** Light shape check: output windows are KVLOG's own, but never forward arbitrary data. */
export function validateSnapshot(value: unknown): OutputSnapshot {
  if (typeof value !== 'object' || value === null) throw new Error('Invalid output state.');
  const json = JSON.stringify(value);
  if (json.length > MAX_SNAPSHOT_CHARS) throw new Error('Output state is too large.');
  const v = value as Record<string, unknown>;
  if (typeof v.blackout !== 'boolean' || typeof v.serviceName !== 'string' || typeof v.notes !== 'string') {
    throw new Error('Invalid output state.');
  }
  if (typeof v.media !== 'object' || v.media === null) throw new Error('Invalid output state.');
  if (typeof v.liveSince !== 'number' || !Number.isFinite(v.liveSince)) throw new Error('Invalid output state.');
  if (!Array.isArray(v.overlays) || v.overlays.length > 100) throw new Error('Invalid output state.');
  return JSON.parse(json) as OutputSnapshot;
}

export class OutputManager {
  private windows = new Map<OutputRole, BrowserWindow>();
  /** Which screen each open window was built for ('window' = a normal movable window). */
  private targets = new Map<OutputRole, string>();
  private problems = new Map<OutputRole, string>();
  private displaysTimer: NodeJS.Timeout | null = null;
  private snapshot: OutputSnapshot | null = null;

  constructor(private readonly deps: OutputManagerDeps) {}

  isOutputSender(webContentsId: number): boolean {
    for (const win of this.windows.values()) {
      if (!win.isDestroyed() && win.webContents.id === webContentsId) return true;
    }
    return false;
  }

  roleOf(webContentsId: number): OutputRole | null {
    for (const [role, win] of this.windows) {
      if (!win.isDestroyed() && win.webContents.id === webContentsId) return role;
    }
    return null;
  }

  private findDisplay(assignment: DisplayAssignment | null): Display | null {
    if (!assignment) return null;
    const all = screen.getAllDisplays();
    // Windows can renumber displays after a restart, so fall back to the display's name.
    return all.find((d) => d.id === assignment.displayId) ?? all.find((d, i) => displayLabel(d, i) === assignment.label) ?? null;
  }

  status(): OutputsStatus {
    const entry = (role: OutputRole): RoleStatus => {
      const win = this.windows.get(role);
      const assignment = getAssignment(role);
      const problem = this.problems.get(role) ?? null;
      if (!win || win.isDestroyed()) return { open: false, fullscreen: false, displayId: null, assignment, problem };
      let displayId: number | null = null;
      try {
        displayId = screen.getDisplayMatching(win.getBounds()).id;
      } catch {
        displayId = null;
      }
      return { open: true, fullscreen: this.targets.get(role)?.startsWith('display:') ?? false, displayId, assignment, problem };
    };
    return { projector: entry('projector'), stage: entry('stage') };
  }

  private notify(): void {
    const main = this.deps.mainWindow();
    if (main && !main.isDestroyed()) main.webContents.send('outputs:changed', this.status());
  }

  open(role: OutputRole): void {
    const assignment = getAssignment(role);
    const display = this.findDisplay(assignment);
    if (assignment && !display) this.problems.set(role, `${assignment.label} is not connected, so it opened in a window.`);
    else this.problems.delete(role);

    const target = display ? `display:${display.id}` : 'window';
    const existing = this.windows.get(role);
    if (existing && !existing.isDestroyed() && this.targets.get(role) === target) {
      if (display && !this.sameBounds(existing, display)) existing.setBounds(display.bounds);
      existing.showInactive();
    } else {
      // Moving a full-screen window to another screen crashes on some Windows PCs,
      // so close the old window and build a fresh one on the new screen.
      if (existing && !existing.isDestroyed()) existing.destroy();
      this.create(role, display);
    }
    this.notify();
  }

  private coversMainWindow(display: Display): boolean {
    const main = this.deps.mainWindow();
    if (!main || main.isDestroyed()) return false;
    return screen.getDisplayMatching(main.getBounds()).id === display.id;
  }

  private sameBounds(win: BrowserWindow, display: Display): boolean {
    const a = win.getBounds();
    const b = display.bounds;
    return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
  }

  close(role: OutputRole): void {
    const win = this.windows.get(role);
    if (win && !win.isDestroyed()) win.close();
  }

  closeAll(): void {
    for (const role of ROLES) this.close(role);
  }

  assign(role: OutputRole, displayId: number | null): void {
    if (displayId === null) {
      setAssignment(role, null);
    } else {
      const all = screen.getAllDisplays();
      const index = all.findIndex((d) => d.id === displayId);
      if (index === -1) throw new Error('That display is no longer connected.');
      setAssignment(role, { displayId, label: displayLabel(all[index], index) });
    }
    const win = this.windows.get(role);
    if (win && !win.isDestroyed()) this.open(role);
    else this.notify();
  }

  publish(snapshot: OutputSnapshot): void {
    this.snapshot = snapshot;
    for (const win of this.windows.values()) {
      if (!win.isDestroyed()) win.webContents.send('output:state', snapshot);
    }
  }

  getSnapshot(): OutputSnapshot | null {
    return this.snapshot;
  }

  /** Called when a display is plugged in or removed. */
  onDisplaysChanged(): void {
    // Windows sends several events while a screen is plugged in or switched; act once it settles.
    if (this.displaysTimer) clearTimeout(this.displaysTimer);
    this.displaysTimer = setTimeout(() => {
      this.displaysTimer = null;
      for (const role of ROLES) {
        const win = this.windows.get(role);
        if (win && !win.isDestroyed()) this.safeOpen(role);
      }
      this.notify();
    }, 800);
  }

  private safeOpen(role: OutputRole): void {
    try {
      this.open(role);
    } catch (error) {
      this.problems.set(role, `Could not move the output: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private create(role: OutputRole, display: Display | null): BrowserWindow {
    let bounds: Electron.Rectangle;
    if (display) {
      bounds = display.bounds;
    } else {
      const area = screen.getPrimaryDisplay().workArea;
      const width = Math.min(1280, Math.round(area.width * 0.7));
      const height = Math.round((width * 9) / 16);
      bounds = { width, height, x: Math.round(area.x + (area.width - width) / 2), y: Math.round(area.y + (area.height - height) / 2) };
    }
    // On an assigned screen: a borderless window that exactly covers it. No native full-screen
    // switch, which is what crashed when changing screens. Otherwise a normal window.
    const win = new BrowserWindow({
      ...bounds,
      show: false,
      frame: !display,
      resizable: !display,
      movable: !display,
      skipTaskbar: !!display,
      title: TITLES[role],
      backgroundColor: '#000000',
      autoHideMenuBar: true,
      webPreferences: { ...this.deps.webPreferences }
    });
    win.on('closed', () => {
      // A replaced window closes after its successor is registered; don't forget the new one.
      if (this.windows.get(role) !== win) return;
      this.windows.delete(role);
      this.targets.delete(role);
      this.problems.delete(role);
      this.notify();
    });
    win.webContents.on('render-process-gone', (_e, details) => {
      if (details.reason === 'clean-exit' || win.isDestroyed()) return;
      this.problems.set(role, 'The output stopped and was restarted.');
      this.deps.load(win, role);
      this.notify();
    });
    win.once('ready-to-show', () => {
      if (win.isDestroyed()) return;
      if (display) win.setBounds(display.bounds); // Windows can resize it on screens with different scaling.
      win.showInactive();
      if (display && !this.coversMainWindow(display)) win.setAlwaysOnTop(true, 'screen-saver');
      this.notify();
    });
    this.windows.set(role, win);
    this.targets.set(role, display ? `display:${display.id}` : 'window');
    this.deps.load(win, role);
    return win;
  }
}
