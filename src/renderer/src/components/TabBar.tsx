import { PASS_DEFS, PROJECT_TAB } from '../../../shared/types'
import type { SlotType } from '../inputs/registry'

interface Props {
  activeTabIndex: number
  slotTypes: Record<string, SlotType>
  onSwitch: (index: number) => void
}

function tabLabel(pass: typeof PASS_DEFS[number], slotTypes: Record<string, SlotType>): string {
  if (!pass.isBuffer) return pass.label
  const type = slotTypes[pass.id]
  return type === 'shader' ? pass.label : type
}

export function TabBar({ activeTabIndex, slotTypes, onSwitch }: Props) {
  return (
    <nav className="tabs" aria-label="shader passes">
      {PASS_DEFS.map((pass, i) => (
        <button
          key={pass.id}
          className={'tab' + (i === activeTabIndex ? ' active' : '')}
          tabIndex={-1}
          onClick={() => onSwitch(i)}
        >
          <span>{i + 1}</span>
          <span className="tab-label">{tabLabel(pass, slotTypes)}</span>
        </button>
      ))}
      <button
        className={'tab tab-project' + (activeTabIndex === PROJECT_TAB ? ' active' : '')}
        tabIndex={-1}
        onClick={() => onSwitch(PROJECT_TAB)}
      >
        <span>0</span>
        <span className="tab-label">project</span>
      </button>
    </nav>
  )
}
