import type { CompileDiagnostic } from './webglTypes'

const GLSL_INFO_LOG_LINE_RE = /ERROR:\s*\d+:(\d+):\s*(.*)/g

function toSourceLine(logLine: number, source: string): number {
  const versionLine = source.split('\n').findIndex(line => line.trimStart().startsWith('#version')) + 1
  const injectedDefineLine = versionLine > 0
  const sourceLine = injectedDefineLine && logLine > versionLine ? logLine - 1 : logLine
  return Math.max(1, Math.min(sourceLine, source.split('\n').length))
}

export function parseCompileDiagnostics(passIndex: number, source: string, message: string): CompileDiagnostic[] {
  const diagnostics: CompileDiagnostic[] = []
  GLSL_INFO_LOG_LINE_RE.lastIndex = 0

  for (const match of message.matchAll(GLSL_INFO_LOG_LINE_RE)) {
    const logLine = Number(match[1])
    const detail = match[2]?.trim() || message
    diagnostics.push({
      passIndex,
      line: Number.isFinite(logLine) ? toSourceLine(logLine, source) : 1,
      message: detail,
    })
  }

  return diagnostics.length > 0
    ? diagnostics
    : [{ passIndex, line: 1, message }]
}
