import { useEffect, useRef } from 'react'
import { PASS_DEFS, INPUTS_TAB } from '../../../shared/types'
import { TabBar } from './TabBar'
import { InputsPanel } from './InputsPanel'
import { MonacoHandle } from '../hooks/useMonaco'
import { WebGLHandle } from '../hooks/useWebGL'
import { INPUT_DRIVERS, SlotType } from '../inputs/registry'

interface Props {
  monaco:         MonacoHandle
  webgl:          WebGLHandle
  activeTabIndex: number
  slotTypes:      Record<string, SlotType>
  hidden:         boolean
  onSwitch:       (index: number) => void
  onSetSlotType:  (slotId: string, type: SlotType) => void
}

export function EditorView({ monaco, webgl, activeTabIndex, slotTypes, hidden, onSwitch, onSetSlotType }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const hideMonaco = import.meta.env.VITE_HIDE_MONACO === '1'

  useEffect(() => {
    if (hideMonaco) return
    if (containerRef.current) monaco.init(containerRef.current)
    return () => monaco.dispose()
  }, [hideMonaco])

  const activePass = PASS_DEFS[activeTabIndex]
  const activeInputType = activePass?.isBuffer ? slotTypes[activePass.id] : 'shader'
  const showEditor = activeTabIndex !== INPUTS_TAB && activeInputType === 'shader'
  const showResource = activeTabIndex !== INPUTS_TAB && activePass?.isBuffer && activeInputType !== 'shader'
  const showInputs = activeTabIndex === INPUTS_TAB
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

      {showInputs && (
        <InputsPanel slotTypes={slotTypes} onSetSlotType={onSetSlotType} />
      )}

      <div className="bottom-bar">
        <TabBar activeTabIndex={activeTabIndex} slotTypes={slotTypes} onSwitch={onSwitch} />
        <div className="hint">cmd+enter run &nbsp;|&nbsp; esc return</div>
      </div>
    </section>
  )
}
