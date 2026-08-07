import { useState, type FormEvent } from 'react'

interface LoginProps {
  onLogin: () => void
}

export default function Login({ onLogin }: LoginProps) {
  const [loading, setLoading] = useState(false)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    window.setTimeout(() => onLogin(), 400)
  }

  return (
    <div className="h-screen w-screen flex items-center justify-center" style={{ background: '#F3F3F3' }}>
      <form
        onSubmit={handleSubmit}
        className="w-[360px] max-w-[92vw] rounded-lg bg-white p-8"
        style={{ border: '1px solid #E5E5E5', boxShadow: '0 8px 24px rgba(0,0,0,0.06)' }}
      >
        <div className="flex items-center gap-2.5 mb-6">
          <div
            className="w-9 h-9 rounded flex items-center justify-center text-white font-bold"
            style={{ background: '#0E7490' }}
          >
            F
          </div>
          <div className="text-[18px] font-semibold" style={{ color: '#1A1A1A' }}>
            Figma
          </div>
        </div>
        <p className="text-[14px] mb-6" style={{ color: '#666' }}>
          Sign in to open your books.
        </p>
        <input
          type="email"
          defaultValue="user@figma.com"
          className="w-full px-3 py-2 rounded mb-3 text-[14px] outline-none"
          style={{ border: '1px solid #CCC' }}
        />
        <input
          type="password"
          defaultValue="password"
          className="w-full px-3 py-2 rounded mb-5 text-[14px] outline-none"
          style={{ border: '1px solid #CCC' }}
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded text-[14px] font-semibold text-white disabled:opacity-70"
          style={{ background: '#0E7490' }}
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
