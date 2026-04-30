import { PASS_DEFS } from '../../../shared/types'
import { INPUT_DRIVERS, INPUT_DRIVER_TYPES, SlotType } from '../inputs/registry'

interface Props {
  slotTypes: Record<string, SlotType>
  onSetSlotType: (slotId: string, type: SlotType) => void
}

export function InputsPanel({ slotTypes, onSetSlotType }: Props) {
  return (
    <div className="inputs-panel">
      <div className="inputs-content">
        <h1 className="inputs-title">channel mappings</h1>
        <div className="channel-rows">
          {PASS_DEFS.filter(p => p.isBuffer).map((pass, i) => (
            <div key={pass.id} className="inputs-row">
              <span className="inputs-label">channel {i}</span>
              <div className="inputs-options">
                {INPUT_DRIVER_TYPES.map(type => (
                  <button
                    key={type}
                    className={'option-btn' + (slotTypes[pass.id] === type ? ' active' : '')}
                    onClick={() => onSetSlotType(pass.id, type)}
                  >
                    {INPUT_DRIVERS[type].label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
