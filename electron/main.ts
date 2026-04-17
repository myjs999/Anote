import { app, BrowserWindow, ipcMain, dialog, shell, Menu } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import { spawn, ChildProcessWithoutNullStreams } from 'node:child_process';

Menu.setApplicationMenu(null);
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
ipcMain.handle('shell:openExternal', (_e, url: string) => shell.openExternal(url));
ipcMain.handle('fs:clone', async (_e, src: string) => {
  const parsed = path.parse(src);
  let dest = path.join(parsed.dir, parsed.name + ' copy' + parsed.ext);
  let i = 2;
  while (true) {
    try { await fs.access(dest); dest = path.join(parsed.dir, `${parsed.name} copy ${i}${parsed.ext}`); i++; }
    catch { break; }
  }
  const stat = await fs.stat(src);
  if (stat.isDirectory()) await fs.cp(src, dest, { recursive: true });
  else await fs.copyFile(src, dest);
  return dest;
});
ipcMain.handle('fs:exists', async (_e, target: string) => {
  try { await fs.access(target); return true; } catch { return false; }
});
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

// ---- python envs ----
async function runCmd(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { shell: true, windowsHide: true });
    let out = '';
    proc.stdout.setEncoding('utf8');
    proc.stderr.setEncoding('utf8');
    proc.stdout.on('data', (d: string) => { out += d; });
    proc.stderr.on('data', (d: string) => { out += d; });
    const timer = setTimeout(() => { proc.kill(); resolve(out); }, 5000);
    proc.on('close', () => { clearTimeout(timer); resolve(out); });
    proc.on('error', () => { clearTimeout(timer); resolve(''); });
  });
}

type PythonEnv = { name: string; exePath: string; version: string; type: string };

ipcMain.handle('python:listEnvs', async () => {
  const envs: PythonEnv[] = [];
  const seen = new Set<string>();

  const getVersion = async (exe: string): Promise<string> => {
    const out = await runCmd(exe, ['--version']);
    const m = out.match(/Python\s+(\S+)/i);
    return m ? m[1] : 'unknown';
  };

  // 1. Windows Python Launcher: py -0p lists all registered Pythons
  const pyOut = await runCmd('py', ['-0p']);
  for (const line of pyOut.split('\n')) {
    const m = line.match(/^\s*-?(\S+)\s+(.+\.exe)/i);
    if (m) {
      const exePath = m[2].trim();
      if (!seen.has(exePath.toLowerCase())) {
        seen.add(exePath.toLowerCase());
        const version = await getVersion(`"${exePath}"`);
        envs.push({ name: `Python ${m[1]}`, exePath, version, type: 'system' });
      }
    }
  }

  // 2. where python — catches anything in PATH not caught above
  const whereOut = await runCmd('where', ['python']);
  for (const line of whereOut.split('\n')) {
    const p = line.trim();
    if (p && p.toLowerCase().endsWith('.exe') && !seen.has(p.toLowerCase())) {
      seen.add(p.toLowerCase());
      const version = await getVersion(`"${p}"`);
      envs.push({ name: path.basename(path.dirname(p)), exePath: p, version, type: 'system' });
    }
  }

  // 3. Conda environments
  const condaOut = await runCmd('conda', ['env', 'list', '--json']);
  try {
    const json = JSON.parse(condaOut.slice(condaOut.indexOf('{')));
    const condaEnvs: string[] = json.envs ?? [];
    for (let i = 0; i < condaEnvs.length; i++) {
      const envPath = condaEnvs[i];
      const exePath = path.join(envPath, 'python.exe');
      if (!seen.has(exePath.toLowerCase())) {
        try {
          await fs.access(exePath);
          seen.add(exePath.toLowerCase());
          const version = await getVersion(`"${exePath}"`);
          const name = i === 0 ? 'base' : path.basename(envPath);
          envs.push({ name: `conda: ${name}`, exePath, version, type: 'conda' });
        } catch {}
      }
    }
  } catch {}

  // 4. Scan common venv/conda directories
  const homeDir = process.env.USERPROFILE ?? process.env.HOME ?? '';
  const scanDirs = [
    path.join(homeDir, 'anaconda3', 'envs'),
    path.join(homeDir, 'miniconda3', 'envs'),
    path.join(homeDir, 'miniforge3', 'envs'),
    path.join(homeDir, '.virtualenvs'),
    path.join(homeDir, 'Envs'),
    'C:\\ProgramData\\Anaconda3\\envs',
    'C:\\ProgramData\\Miniconda3\\envs',
  ];
  for (const dir of scanDirs) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries.filter((e) => e.isDirectory())) {
        const exePath = path.join(dir, entry.name, 'python.exe');
        if (!seen.has(exePath.toLowerCase())) {
          try {
            await fs.access(exePath);
            seen.add(exePath.toLowerCase());
            const version = await getVersion(`"${exePath}"`);
            envs.push({ name: entry.name, exePath, version, type: 'venv' });
          } catch {}
        }
      }
    } catch {}
  }

  return envs;
});
