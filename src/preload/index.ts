import { contextBridge, ipcRenderer, webUtils } from 'electron'

contextBridge.exposeInMainWorld('appMeta', {
  platform: process.platform,
  isFullscreen: () => ipcRenderer.invoke('is-window-fullscreen'),
  requestMediaAccess: (mediaType: 'microphone' | 'camera') => ipcRenderer.invoke('request-media-access', mediaType),
  onFullscreenChange: (cb: (fullscreen: boolean) => void) => {
    const listener = (_: Electron.IpcRendererEvent, fullscreen: boolean) => cb(fullscreen)
    ipcRenderer.on('window-fullscreen-change', listener)
    return () => ipcRenderer.removeListener('window-fullscreen-change', listener)
  },
  onResizeStateChange: (cb: (state: { active: boolean; width: number; height: number }) => void) => {
    const listener = (_: Electron.IpcRendererEvent, state: { active: boolean; width: number; height: number }) => cb(state)
    ipcRenderer.on('window-resize-state-change', listener)
    return () => ipcRenderer.removeListener('window-resize-state-change', listener)
  },
})

contextBridge.exposeInMainWorld('api', {
  readFile: (filePath: string) => ipcRenderer.invoke('read-file', filePath),
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
})

contextBridge.exposeInMainWorld('projectApi', {
  saveAs: (payload: unknown) => ipcRenderer.invoke('save-project-as', payload),
  saveTo: (projectPath: string, payload: unknown) => ipcRenderer.invoke('save-project', { projectPath, payload }),
  load:   () => ipcRenderer.invoke('load-project'),

  onMenuNew:    (cb: () => void) => { const l = () => cb(); ipcRenderer.on('menu-new',     l); return () => ipcRenderer.removeListener('menu-new',     l) },
  onMenuOpen:   (cb: () => void) => { const l = () => cb(); ipcRenderer.on('menu-open',    l); return () => ipcRenderer.removeListener('menu-open',    l) },
  onMenuSave:   (cb: () => void) => { const l = () => cb(); ipcRenderer.on('menu-save',    l); return () => ipcRenderer.removeListener('menu-save',    l) },
  onMenuSaveAs: (cb: () => void) => { const l = () => cb(); ipcRenderer.on('menu-save-as', l); return () => ipcRenderer.removeListener('menu-save-as', l) },
})
