import { contextBridge, ipcRenderer } from 'electron';

export type Entry = { name: string; path: string; isDir: boolean };
export type PythonEnv = { name: string; exePath: string; version: string; type: string };

const api = {
  pickFolder: (): Promise<string | null> => ipcRenderer.invoke('dialog:pickFolder'),
  list: (dir: string): Promise<Entry[]> => ipcRenderer.invoke('fs:list', dir),
  read: (file: string): Promise<string> => ipcRenderer.invoke('fs:read', file),
  write: (file: string, content: string): Promise<void> => ipcRenderer.invoke('fs:write', file, content),
  create: (parent: string, name: string, isDir: boolean): Promise<string> => ipcRenderer.invoke('fs:create', parent, name, isDir),
  rename: (oldPath: string, newPath: string): Promise<void> => ipcRenderer.invoke('fs:rename', oldPath, newPath),
  remove: (target: string): Promise<void> => ipcRenderer.invoke('fs:delete', target),
  stat: (target: string): Promise<{ size: number; mtime: string; isDir: boolean }> => ipcRenderer.invoke('fs:stat', target),
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('shell:openExternal', url),
  clone: (src: string): Promise<string> => ipcRenderer.invoke('fs:clone', src),
  exists: (path: string): Promise<boolean> => ipcRenderer.invoke('fs:exists', path),
  python: {
    listEnvs: (): Promise<PythonEnv[]> => ipcRenderer.invoke('python:listEnvs'),
  },
  terminal: {
    create: (cwd: string): Promise<number> => ipcRenderer.invoke('terminal:create', cwd),
    write: (id: number, data: string): void => ipcRenderer.send('terminal:write', id, data),
    kill: (id: number): void => ipcRenderer.send('terminal:kill', id),
    onData: (id: number, cb: (data: string) => void): (() => void) => {
      const handler = (_: Electron.IpcRendererEvent, data: string) => cb(data);
      ipcRenderer.on(`terminal:data:${id}`, handler);
      return () => ipcRenderer.removeListener(`terminal:data:${id}`, handler);
    },
    onExit: (id: number, cb: () => void): (() => void) => {
      const handler = () => cb();
      ipcRenderer.once(`terminal:exit:${id}`, handler);
      return () => ipcRenderer.removeListener(`terminal:exit:${id}`, handler);
    },
  },
};

contextBridge.exposeInMainWorld('api', api);
export type Api = typeof api;
