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
  private problems = new Map<OutputRole, string>();
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
      return {
        open: true,
        fullscreen: win.isFullScreen(),
        displayId: screen.getDisplayMatching(win.getBounds()).id,
        assignment,
        problem
      };
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

    let win = this.windows.get(role);
    if (!win || win.isDestroyed()) win = this.create(role);
    this.place(win, display);
    this.notify();
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
    for (const role of ROLES) {
      const win = this.windows.get(role);
      if (win && !win.isDestroyed()) this.open(role);
    }
    this.notify();
  }

  private create(role: OutputRole): BrowserWindow {
    const win = new BrowserWindow({
      width: 1280,
      height: 720,
      show: false,
      title: TITLES[role],
      backgroundColor: '#000000',
      autoHideMenuBar: true,
      webPreferences: { ...this.deps.webPreferences }
    });
    win.on('closed', () => {
      this.windows.delete(role);
      this.problems.delete(role);
      this.notify();
    });
    win.on('enter-full-screen', () => this.notify());
    win.on('leave-full-screen', () => this.notify());
    this.windows.set(role, win);
    this.deps.load(win, role);
    return win;
  }

  private place(win: BrowserWindow, display: Display | null): void {
    // Leave full screen first; moving a full-screen window is unreliable on Windows.
    if (win.isFullScreen()) {
      win.once('leave-full-screen', () => this.place(win, display));
      win.setFullScreen(false);
      return;
    }
    if (display) {
      win.setBounds(display.bounds);
      win.show();
      win.setFullScreen(true);
    } else {
      const area = screen.getPrimaryDisplay().workArea;
      const width = Math.min(1280, Math.round(area.width * 0.7));
      const height = Math.round((width * 9) / 16);
      win.setBounds({ width, height, x: Math.round(area.x + (area.width - width) / 2), y: Math.round(area.y + (area.height - height) / 2) });
      win.show();
    }
    const main = this.deps.mainWindow();
    if (main && !main.isDestroyed()) main.focus();
  }
}
