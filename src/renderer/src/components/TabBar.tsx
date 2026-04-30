import { PASS_DEFS, INPUTS_TAB } from '../../../shared/types'
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
          onClick={() => onSwitch(i)}
        >
          {i + 1} {tabLabel(pass, slotTypes)}
        </button>
      ))}
      <button
        className={'tab tab-inputs' + (activeTabIndex === INPUTS_TAB ? ' active' : '')}
        onClick={() => onSwitch(INPUTS_TAB)}
      >
        0 inputs
      </button>
    </nav>
  )
}
