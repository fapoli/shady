import { useEffect, useRef, useState } from 'react'
import { PASS_DEFS, PROJECT_TAB, ProjectSettings } from '../../../shared/types'
import { TabBar } from './TabBar'
import { ProjectPanel } from './ProjectPanel'
import { FindWidget } from './FindWidget'
import { MonacoHandle } from '../hooks/useMonaco'
import { WebGLHandle } from '../hooks/useWebGL'
import { INPUT_DRIVERS, SlotType } from '../inputs/registry'

interface Props {
  monaco:         MonacoHandle
  webgl:          WebGLHandle
  activeTabIndex: number
  slotTypes:      Record<string, SlotType>
  projectSettings: ProjectSettings
  hidden:         boolean
  onSwitch:       (index: number) => void
  onSetSlotType:  (slotId: string, type: SlotType) => void
  onSetProjectSettings: (settings: ProjectSettings) => void
}

export function EditorView({
  monaco, webgl, activeTabIndex, slotTypes, projectSettings, hidden,
  onSwitch, onSetSlotType, onSetProjectSettings
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [findOpen, setFindOpen] = useState(false)
  const hideMonaco = import.meta.env.VITE_HIDE_MONACO === '1'

  useEffect(() => {
    if (hideMonaco) return
    if (containerRef.current) monaco.init(containerRef.current)
    return () => monaco.dispose()
  }, [hideMonaco])

  const activePass = PASS_DEFS[activeTabIndex]
  const activeInputType = activePass?.isBuffer ? slotTypes[activePass.id] : 'shader'
  const showEditor = activeTabIndex !== PROJECT_TAB && activeInputType === 'shader'
  const showResource = activeTabIndex !== PROJECT_TAB && activePass?.isBuffer && activeInputType !== 'shader'
  const showProject = activeTabIndex === PROJECT_TAB
  const ShaderEditor = INPUT_DRIVERS.shader.Editor
  const ResourceEditor = activeInputType ? INPUT_DRIVERS[activeInputType]?.Editor : null

  return (
    <section className={'view view-editor' + (hidden ? ' hidden' : '')}>
      <div className="editor-drag-region" />

      <ShaderEditor
        slotId={activePass?.id ?? 'main'}
        hidden={!showEditor}
        editorRef={containerRef}
        webgl={webgl}
      />

      {showResource && activePass && ResourceEditor && (
        <ResourceEditor
          slotId={activePass.id}
          editorRef={containerRef}
          webgl={webgl}
        />
      )}

      {showProject && (
        <ProjectPanel
          slotTypes={slotTypes}
          projectSettings={projectSettings}
          onSetSlotType={onSetSlotType}
          onSetProjectSettings={onSetProjectSettings}
        />
      )}

      <FindWidget
        monaco={monaco}
        activeTabIndex={activeTabIndex}
        visible={showEditor && !hidden}
        onOpenChange={setFindOpen}
      />

      <div className={'bottom-bar' + (findOpen ? ' hidden' : '')}>
        <TabBar activeTabIndex={activeTabIndex} slotTypes={slotTypes} onSwitch={onSwitch} />
        <div className="hint">cmd+enter run &nbsp;|&nbsp; esc return</div>
      </div>
    </section>
  )
}
