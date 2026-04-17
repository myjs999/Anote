import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import { spawn, ChildProcessWithoutNullStreams } from 'node:child_process';

const isDev = !!process.env.VITE_DEV_SERVER_URL;

async function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    await win.loadURL(process.env.VITE_DEV_SERVER_URL!);
  } else {
    await win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

// ---- file system ----
ipcMain.handle('dialog:pickFolder', async () => {
  const res = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  return res.canceled ? null : res.filePaths[0];
});
ipcMain.handle('fs:list', async (_e, dir: string) => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries.map((d) => ({ name: d.name, path: path.join(dir, d.name), isDir: d.isDirectory() }));
});
ipcMain.handle('fs:read', async (_e, file: string) => fs.readFile(file, 'utf8'));
ipcMain.handle('fs:write', async (_e, file: string, content: string) => fs.writeFile(file, content, 'utf8'));
ipcMain.handle('fs:create', async (_e, parent: string, name: string, isDir: boolean) => {
  const target = path.join(parent, name);
  if (isDir) await fs.mkdir(target, { recursive: true });
  else await fs.writeFile(target, '', { flag: 'wx' });
  return target;
});
ipcMain.handle('fs:rename', async (_e, oldPath: string, newPath: string) => fs.rename(oldPath, newPath));
ipcMain.handle('fs:delete', async (_e, target: string) => fs.rm(target, { recursive: true, force: true }));
ipcMain.handle('fs:stat', async (_e, target: string) => {
  const s = await fs.stat(target);
  return { size: s.size, mtime: s.mtime.toISOString(), isDir: s.isDirectory() };
});

// ---- terminal ----
const shells = new Map<number, ChildProcessWithoutNullStreams>();
let nextId = 1;

ipcMain.handle('terminal:create', (event, cwd: string) => {
  const id = nextId++;
  const isWin = process.platform === 'win32';
  const shell = isWin ? 'powershell.exe' : (process.env.SHELL ?? 'bash');
  // Force UTF-8 output so Chinese/CJK characters render correctly
  const args = isWin
    ? ['-NoLogo', '-NoExit', '-Command',
       '[Console]::InputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8']
    : [];

  const proc = spawn(shell, args, {
    cwd,
    env: {
      ...process.env as Record<string, string>,
      TERM: 'xterm-256color', COLORTERM: 'truecolor', FORCE_COLOR: '1',
      PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1',
    },
    stdio: 'pipe',
    windowsHide: true,
  }) as ChildProcessWithoutNullStreams;

  proc.stdout.setEncoding('utf8');
  proc.stderr.setEncoding('utf8');

  proc.stdout.on('data', (d: string) => {
    BrowserWindow.fromWebContents(event.sender)?.webContents.send(`terminal:data:${id}`, d);
  });
  proc.stderr.on('data', (d: string) => {
    BrowserWindow.fromWebContents(event.sender)?.webContents.send(`terminal:data:${id}`, d);
  });
  proc.on('close', () => {
    BrowserWindow.fromWebContents(event.sender)?.webContents.send(`terminal:exit:${id}`);
    shells.delete(id);
  });

  shells.set(id, proc);
  return id;
});

ipcMain.on('terminal:write', (_e, id: number, data: string) => {
  const proc = shells.get(id);
  if (proc) proc.stdin.write(data);
});

ipcMain.on('terminal:kill', (_e, id: number) => {
  const proc = shells.get(id);
  if (proc) { proc.kill(); shells.delete(id); }
});
