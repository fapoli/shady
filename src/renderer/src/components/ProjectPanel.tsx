import { DEFAULT_PROJECT_SETTINGS, PASS_DEFS, ProjectSettings } from '../../../shared/types'
import { INPUT_DRIVERS, INPUT_DRIVER_TYPES, SlotType } from '../inputs/registry'

interface Props {
  slotTypes:       Record<string, SlotType>
  projectSettings: ProjectSettings
  onSetSlotType:   (slotId: string, type: SlotType) => void
  onSetProjectSettings: (settings: ProjectSettings) => void
}

export function ProjectPanel({ slotTypes, projectSettings, onSetSlotType, onSetProjectSettings }: Props) {
  const settings = { ...DEFAULT_PROJECT_SETTINGS, ...projectSettings }

  return (
    <div className="project-panel">
      <div className="project-content">
        <section className="project-section">
          <h1 className="project-title">channels</h1>
          <div className="project-rows">
            {PASS_DEFS.filter(p => p.isBuffer).map((pass, i) => (
              <div key={pass.id} className="project-row">
                <span className="project-label">channel {i}</span>
                <div className="project-options">
                  {INPUT_DRIVER_TYPES.map(type => (
                    <button
                      key={type}
                      className={'option-btn' + (slotTypes[pass.id] === type ? ' active' : '')}
                      tabIndex={-1}
                      onClick={() => onSetSlotType(pass.id, type)}
                    >
                      {INPUT_DRIVERS[type].label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="project-section">
          <h1 className="project-title">settings</h1>
          <div className="project-rows">
            <div className="project-row">
              <span className="project-label">mouse</span>
              <div className="project-options">
                <button
                  className={'option-btn' + (settings.mouseTracking === 'drag' ? ' active' : '')}
                  tabIndex={-1}
                  onClick={() => onSetProjectSettings({ ...settings, mouseTracking: 'drag' })}
                >
                  drag
                </button>
                <button
                  className={'option-btn' + (settings.mouseTracking === 'hover' ? ' active' : '')}
                  tabIndex={-1}
                  onClick={() => onSetProjectSettings({ ...settings, mouseTracking: 'hover' })}
                >
                  hover
                </button>
              </div>
            </div>
            <div className="project-row">
              <span className="project-label">resolution</span>
              <div className="project-options">
                {[
                  ['auto', 'auto'],
                  ['0.5', '0.5x'],
                  ['1', '1x'],
                  ['2', '2x'],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    className={'option-btn' + (settings.resolutionScale === value ? ' active' : '')}
                    tabIndex={-1}
                    onClick={() => onSetProjectSettings({ ...settings, resolutionScale: value as ProjectSettings['resolutionScale'] })}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
