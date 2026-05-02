import path from 'node:path'
import fs from 'node:fs'
import { spawn, ChildProcessWithoutNullStreams } from 'node:child_process'
import { app, BrowserWindow, ipcMain, dialog, Menu, systemPreferences, shell } from 'electron'

interface SaveChannelEntry {
  type: string
  filePath?: string
  fileName?: string
}

interface SavePayload {
  shaders: Record<string, string>
  channels: Record<string, SaveChannelEntry>
  settings?: {
    mouseTracking?: 'drag' | 'hover'
    resolutionScale?: 'auto' | '0.5' | '1' | '2'
  }
}

interface LoadedProject {
  shaders: Record<string, string>
  channels: Record<string, { type: string; filePath?: string; fileName?: string }>
  settings?: {
    mouseTracking?: 'drag' | 'hover'
    resolutionScale?: 'auto' | '0.5' | '1' | '2'
  }
  projectPath: string
}

const RECENT_PROJECTS_FILE = 'recent-projects.json'
const MAX_RECENT_PROJECTS = 10
const EXPORT_WIDTH = 800
const EXPORT_HEIGHT = 800
const EXPORT_FPS = 60

interface ExportSession {
  process: ChildProcessWithoutNullStreams
  outputPath: string
  stderr: string
}

const exportSessions = new Map<string, ExportSession>()

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

function timestampFileName(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
  ].join('-') + '_' + [
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join('-') + '.mp4'
}

function findFfmpeg(): string {
  const candidates = [
    process.env.FFMPEG_PATH,
    '/opt/homebrew/bin/ffmpeg',
    '/usr/local/bin/ffmpeg',
    '/usr/bin/ffmpeg',
    'ffmpeg',
  ].filter(Boolean) as string[]

  for (const candidate of candidates) {
    if (candidate === 'ffmpeg') return candidate
    if (fs.existsSync(candidate)) return candidate
  }
  return 'ffmpeg'
}

function recentProjectsPath(): string {
  return path.join(app.getPath('userData'), RECENT_PROJECTS_FILE)
}

function readRecentProjects(): string[] {
  try {
    const value = JSON.parse(fs.readFileSync(recentProjectsPath(), 'utf-8')) as unknown
    return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []
  } catch {
    return []
  }
}

function writeRecentProjects(projectPaths: string[]): void {
  fs.mkdirSync(app.getPath('userData'), { recursive: true })
  fs.writeFileSync(recentProjectsPath(), JSON.stringify(projectPaths, null, 2), 'utf-8')
}

function addRecentProject(projectPath: string, win?: BrowserWindow): void {
  const normalized = path.resolve(projectPath)
  const projects = [
    normalized,
    ...readRecentProjects().filter(entry => path.resolve(entry) !== normalized),
  ].slice(0, MAX_RECENT_PROJECTS)
  writeRecentProjects(projects)
  if (process.platform === 'darwin') app.addRecentDocument(normalized)
  if (win) createMenu(win)
}

function clearRecentProjects(win: BrowserWindow): void {
  writeRecentProjects([])
  if (process.platform === 'darwin') app.clearRecentDocuments()
  createMenu(win)
}

async function readProject(folder: string): Promise<LoadedProject> {
  let config: {
    version: number
    channels: Record<string, { type: string; filePath?: string }>
    settings?: {
      mouseTracking?: 'drag' | 'hover'
      resolutionScale?: 'auto' | '0.5' | '1' | '2'
    }
  }
  try {
    config = JSON.parse(await fs.promises.readFile(path.join(folder, 'project.json'), 'utf-8'))
  } catch {
    throw new Error('Not a valid project folder (missing project.json)')
  }

  const shaders: Record<string, string> = {}
  for (const passId of ['main', 'bufferA', 'bufferB', 'bufferC', 'bufferD']) {
    try {
      shaders[passId] = await fs.promises.readFile(path.join(folder, shaderFileName(passId)), 'utf-8')
    } catch { /* missing shader file - leave undefined */ }
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

  return { shaders, channels, settings: config.settings, projectPath: folder }
}

ipcMain.handle('read-file', (_, filePath: string) => fs.promises.readFile(filePath))
ipcMain.handle('is-window-fullscreen', event => {
  return BrowserWindow.fromWebContents(event.sender)?.isFullScreen() ?? false
})
ipcMain.on('renderer-ready', event => {
  BrowserWindow.fromWebContents(event.sender)?.show()
})
ipcMain.handle('request-media-access', async (_, mediaType: unknown) => {
  if (mediaType !== 'microphone' && mediaType !== 'camera') return false
  if (process.platform !== 'darwin') return true
  return systemPreferences.askForMediaAccess(mediaType)
})

ipcMain.handle('export-video-start', async (_, projectPath: string) => {
  const outputDir = path.join(projectPath, 'output')
  await fs.promises.mkdir(outputDir, { recursive: true })
  const outputPath = path.join(outputDir, timestampFileName())
  const exportId = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const ffmpeg = spawn(findFfmpeg(), [
    '-y',
    '-f', 'rawvideo',
    '-pix_fmt', 'rgba',
    '-s', `${EXPORT_WIDTH}x${EXPORT_HEIGHT}`,
    '-r', String(EXPORT_FPS),
    '-i', 'pipe:0',
    '-vf', 'vflip,format=yuv420p',
    '-an',
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '18',
    '-movflags', '+faststart',
    outputPath,
  ])

  const session: ExportSession = { process: ffmpeg, outputPath, stderr: '' }
  ffmpeg.stderr.on('data', chunk => {
    session.stderr += chunk.toString()
    if (session.stderr.length > 8000) session.stderr = session.stderr.slice(-8000)
  })
  exportSessions.set(exportId, session)
  return { exportId, outputPath }
})

ipcMain.handle('export-video-frame', async (_, { exportId, frame }: { exportId: string; frame: Uint8Array }) => {
  const session = exportSessions.get(exportId)
  if (!session) throw new Error('Export session is not active.')
  const buffer = Buffer.from(frame)
  if (session.process.stdin.write(buffer)) return
  await new Promise<void>((resolve, reject) => {
    const onDrain = () => {
      session.process.stdin.removeListener('error', onError)
      resolve()
    }
    const onError = (err: Error) => {
      session.process.stdin.removeListener('drain', onDrain)
      reject(err)
    }
    session.process.stdin.once('drain', onDrain)
    session.process.stdin.once('error', onError)
  })
})

ipcMain.handle('export-video-finish', async (_, exportId: string) => {
  const session = exportSessions.get(exportId)
  if (!session) throw new Error('Export session is not active.')
  exportSessions.delete(exportId)
  const exitCode = await new Promise<number | null>((resolve, reject) => {
    session.process.once('error', reject)
    session.process.once('close', resolve)
    session.process.stdin.end()
  })
  if (exitCode !== 0) throw new Error(session.stderr || `ffmpeg exited with code ${exitCode}`)
  shell.showItemInFolder(session.outputPath)
  return { outputPath: session.outputPath }
})

ipcMain.handle('export-video-cancel', async (_, exportId: string) => {
  const session = exportSessions.get(exportId)
  if (!session) return
  exportSessions.delete(exportId)
  session.process.kill('SIGTERM')
  await fs.promises.rm(session.outputPath, { force: true })
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
    JSON.stringify({ version: 1, channels, settings: payload.settings }, null, 2),
    'utf-8'
  )
}

ipcMain.handle('save-project-as', async (event, payload: SavePayload) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Save Project',
    defaultPath: path.join(app.getPath('documents'), 'untitled'),
    buttonLabel: 'Save Project',
    properties: ['createDirectory'],
  })
  if (canceled || !filePath) return { canceled: true }
  await writeProject(filePath, payload)
  addRecentProject(filePath, BrowserWindow.fromWebContents(event.sender) ?? undefined)
  return { canceled: false, projectPath: filePath }
})

ipcMain.handle('save-project', async (event, { projectPath, payload }: { projectPath: string; payload: SavePayload }) => {
  await writeProject(projectPath, payload)
  addRecentProject(projectPath, BrowserWindow.fromWebContents(event.sender) ?? undefined)
  return { projectPath }
})

ipcMain.handle('load-project', async event => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Open Project',
    buttonLabel: 'Open',
    properties: ['openDirectory'],
  })
  if (canceled || !filePaths[0]) return null

  const folder = filePaths[0]
  const project = await readProject(folder)
  addRecentProject(folder, BrowserWindow.fromWebContents(event.sender) ?? undefined)
  return project
})

ipcMain.handle('load-recent-project', async (event, projectPath: string) => {
  try {
    const folder = path.resolve(projectPath)
    const project = await readProject(folder)
    addRecentProject(folder, BrowserWindow.fromWebContents(event.sender) ?? undefined)
    return project
  } catch (err) {
    const normalized = path.resolve(projectPath)
    writeRecentProjects(readRecentProjects().filter(entry => path.resolve(entry) !== normalized))
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) createMenu(win)
    throw err
  }
})

function createMenu(win: BrowserWindow): void {
  const send = (channel: string) => () => win.webContents.send(channel)
  const recentProjects = readRecentProjects()

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' as const }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'New',      accelerator: 'CmdOrCtrl+N',       click: send('menu-new')     },
        { label: 'Open…',    accelerator: 'CmdOrCtrl+O',       click: send('menu-open')    },
        {
          label: 'Open Recent',
          enabled: recentProjects.length > 0,
          submenu: recentProjects.length > 0
            ? [
                ...recentProjects.map(projectPath => ({
                  label: path.basename(projectPath),
                  sublabel: projectPath,
                  click: () => win.webContents.send('menu-open-recent', projectPath),
                })),
                { type: 'separator' as const },
                { label: 'Clear Recent Projects', click: () => clearRecentProjects(win) },
              ]
            : [{ label: 'No Recent Projects', enabled: false }],
        },
        { type: 'separator' as const },
        { label: 'Save',     accelerator: 'CmdOrCtrl+S',       click: send('menu-save')    },
        { label: 'Save As…', accelerator: 'CmdOrCtrl+Shift+S', click: send('menu-save-as') },
        { type: 'separator' as const },
        { label: 'Export Video', click: send('menu-export-video') },
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
    {
      label: 'View',
      submenu: [
        { label: 'Toggle Stats', accelerator: 'CmdOrCtrl+Shift+F', click: send('menu-toggle-fps') },
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
    show: false,
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

  const sendResizeState = (active: boolean, width = win.getBounds().width, height = win.getBounds().height) => {
    win.webContents.send('window-resize-state-change', { active, width, height })
  }

  const sendFullscreenState = () => win.webContents.send('window-fullscreen-change', win.isFullScreen())

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
