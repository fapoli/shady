import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'

window.MonacoEnvironment = {
  getWorker(_moduleId: string, _label: string): Worker {
    return new EditorWorker()
  }
}
