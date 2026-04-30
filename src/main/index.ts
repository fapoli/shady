import path from 'node:path'
import fs from 'node:fs'
import { app, BrowserWindow, ipcMain, dialog, Menu, systemPreferences } from 'electron'

interface SaveChannelEntry {
  type: string
  filePath?: string
  fileName?: string
}

interface SavePayload {
  shaders: Record<string, string>
  channels: Record<string, SaveChannelEntry>
}

function toProjectRelativePath(projectPath: string, filePath: string): string {
  if (!path.isAbsolute(filePath)) return filePath
  const relativePath = path.relative(projectPath, filePath)
  return relativePath || path.basename(filePath)
}

function fromProjectRelativePath(projectPath: string, filePath: string): string {
  return path.isAbsolute(filePath) ? filePath : path.resolve(projectPath, filePath)
}

function shaderFileName(passId: string): string {
  return `${passId}.glsl`
}

ipcMain.handle('read-file', (_, filePath: string) => fs.promises.readFile(filePath))
ipcMain.handle('is-window-fullscreen', event => {
  return BrowserWindow.fromWebContents(event.sender)?.isFullScreen() ?? false
})
ipcMain.handle('request-media-access', async (_, mediaType: unknown) => {
  if (mediaType !== 'microphone' && mediaType !== 'camera') return false
  if (process.platform !== 'darwin') return true
  return systemPreferences.askForMediaAccess(mediaType)
})

async function writeProject(folderPath: string, payload: SavePayload): Promise<void> {
  await fs.promises.mkdir(folderPath, { recursive: true })

  for (const [passId, source] of Object.entries(payload.shaders)) {
    await fs.promises.writeFile(path.join(folderPath, shaderFileName(passId)), source, 'utf-8')
  }

  const channels: Record<string, { type: string; filePath?: string }> = {}
  for (const [slotId, ch] of Object.entries(payload.channels)) {
    if ((ch.type === 'audio' || ch.type === 'image') && ch.filePath) {
      channels[slotId] = {
        type: ch.type,
        filePath: toProjectRelativePath(folderPath, ch.filePath),
      }
    } else {
      channels[slotId] = { type: ch.type }
    }
  }

  await fs.promises.writeFile(
    path.join(folderPath, 'project.json'),
    JSON.stringify({ version: 1, channels }, null, 2),
    'utf-8'
  )
}

ipcMain.handle('save-project-as', async (_, payload: SavePayload) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Save Project',
    defaultPath: path.join(app.getPath('documents'), 'untitled'),
    buttonLabel: 'Save Project',
    properties: ['createDirectory'],
  })
  if (canceled || !filePath) return { canceled: true }
  await writeProject(filePath, payload)
  return { canceled: false, projectPath: filePath }
})

ipcMain.handle('save-project', async (_, { projectPath, payload }: { projectPath: string; payload: SavePayload }) => {
  await writeProject(projectPath, payload)
  return { projectPath }
})

ipcMain.handle('load-project', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Open Project',
    buttonLabel: 'Open',
    properties: ['openDirectory'],
  })
  if (canceled || !filePaths[0]) return null

  const folder = filePaths[0]

  let config: { version: number; channels: Record<string, { type: string; filePath?: string }> }
  try {
    config = JSON.parse(await fs.promises.readFile(path.join(folder, 'project.json'), 'utf-8'))
  } catch {
    throw new Error('Not a valid project folder (missing project.json)')
  }

  const shaders: Record<string, string> = {}
  for (const passId of ['main', 'bufferA', 'bufferB', 'bufferC', 'bufferD']) {
    try {
      shaders[passId] = await fs.promises.readFile(path.join(folder, shaderFileName(passId)), 'utf-8')
    } catch { /* missing shader file — leave undefined */ }
  }

  const channels: Record<string, { type: string; filePath?: string; fileName?: string }> = {}
  for (const [slotId, ch] of Object.entries(config.channels)) {
    if ((ch.type === 'audio' || ch.type === 'image') && ch.filePath) {
      const filePath = fromProjectRelativePath(folder, ch.filePath)
      channels[slotId] = {
        type:     ch.type,
        filePath,
        fileName: path.basename(filePath),
      }
    } else {
      channels[slotId] = { type: ch.type }
    }
  }

  return { shaders, channels, projectPath: folder }
})

function createMenu(win: BrowserWindow): void {
  const send = (channel: string) => () => win.webContents.send(channel)

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' as const }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'New',      accelerator: 'CmdOrCtrl+N',       click: send('menu-new')     },
        { label: 'Open…',    accelerator: 'CmdOrCtrl+O',       click: send('menu-open')    },
        { type: 'separator' as const },
        { label: 'Save',     accelerator: 'CmdOrCtrl+S',       click: send('menu-save')    },
        { label: 'Save As…', accelerator: 'CmdOrCtrl+Shift+S', click: send('menu-save-as') },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo'      as const },
        { role: 'redo'      as const },
        { type: 'separator' as const },
        { role: 'cut'       as const },
        { role: 'copy'      as const },
        { role: 'paste'     as const },
        { role: 'selectAll' as const },
      ],
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1200,
    height: 810,
    minWidth: 640,
    minHeight: 480,
    backgroundColor: '#000000',
    titleBarStyle: 'hidden',
    autoHideMenuBar: true,
    title: '',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  })

  win.webContents.session.setPermissionCheckHandler((_webContents, permission) => {
    return permission === 'media'
  })
  win.webContents.session.setPermissionRequestHandler((_webContents, permission, callback, details) => {
    if (permission !== 'media') {
      callback(false)
      return
    }

    const media = details as Electron.MediaAccessPermissionRequest
    callback(media.mediaTypes?.some(type => type === 'audio' || type === 'video') ?? false)
  })

  createMenu(win)

  const sendFullscreenState = () => win.webContents.send('window-fullscreen-change', win.isFullScreen())
  const sendResizeState = (active: boolean, width = win.getBounds().width, height = win.getBounds().height) => {
    win.webContents.send('window-resize-state-change', { active, width, height })
  }

  win.on('enter-full-screen', sendFullscreenState)
  win.on('leave-full-screen', sendFullscreenState)
  win.on('will-resize', (_, bounds) => sendResizeState(true, bounds.width, bounds.height))
  win.on('resized', () => sendResizeState(false))
  win.webContents.on('did-finish-load', sendFullscreenState)

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
