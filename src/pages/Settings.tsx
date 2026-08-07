import { useState } from 'react'

export default function Settings({ onBack }: { onBack: () => void }) {
  const [size, setSize] = useState('A4')
  const [saved, setSaved] = useState(false)

  return (
    <div className="h-full overflow-y-auto" style={{ background: '#F3F3F3' }}>
      <header
        className="h-14 flex items-center gap-3 px-8"
        style={{ background: 'white', borderBottom: '1px solid #E5E5E5' }}
      >
        <button onClick={onBack} className="text-[13px]" style={{ color: '#666' }}>
          ← Back
        </button>
        <span className="text-[15px] font-semibold" style={{ color: '#1A1A1A' }}>
          Settings
        </span>
      </header>
      <div className="max-w-[520px] mx-auto px-8 py-8">
        <div className="rounded-lg p-5 space-y-4" style={{ background: 'white', border: '1px solid #E5E5E5' }}>
          <div>
            <label className="text-[12px] font-medium block mb-1.5" style={{ color: '#555' }}>
              Default page size
            </label>
            <select
              value={size}
              onChange={(e) => setSize(e.target.value)}
              className="w-full px-3 py-2 rounded text-[14px] outline-none"
              style={{ border: '1px solid #CCC' }}
            >
              <option>A4</option>
              <option>B5</option>
              <option>8×8</option>
            </select>
          </div>
          <button
            onClick={() => {
              setSaved(true)
              window.setTimeout(() => setSaved(false), 1500)
            }}
            className="px-4 py-2 rounded text-[13px] font-semibold text-white"
            style={{ background: '#0E7490' }}
          >
            {saved ? 'Saved' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
