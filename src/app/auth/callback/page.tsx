'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AuthCallbackPage() {
  const router = useRouter()
  const [status, setStatus] = useState<'exchanging' | 'success' | 'error'>('exchanging')
  const [message, setMessage] = useState('Completing sign in...')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    if (!code) {
      setStatus('error')
      setMessage('No authorization code found in the URL.')
      return
    }

    let cancelled = false

    const exchange = async () => {
      try {
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (cancelled) return
        if (error) {
          setStatus('error')
          setMessage(error.message || 'Failed to complete sign in.')
          return
        }
        setStatus('success')
        setMessage('Signed in successfully!')
        setTimeout(() => {
          if (!cancelled) router.replace('/')
        }, 500)
      } catch (err) {
        if (!cancelled) {
          setStatus('error')
          setMessage(err instanceof Error ? err.message : 'Something went wrong.')
        }
      }
    }

    exchange()
    return () => { cancelled = true }
  }, [router])

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      padding: '24px',
      fontFamily: 'system-ui, sans-serif',
      background: '#1a1a2e',
      color: '#e2e8f0',
      textAlign: 'center',
    }}>
      {status === 'exchanging' && (
        <>
          <div style={{
            width: 40,
            height: 40,
            border: '3px solid #334155',
            borderTopColor: '#3b82f6',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            marginBottom: 16,
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </>
      )}
      {status === 'success' && (
        <div style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: '#22c55e',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 20,
          marginBottom: 16,
        }}>✓</div>
      )}
      {status === 'error' && (
        <div style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: '#ef4444',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 20,
          marginBottom: 16,
        }}>✕</div>
      )}
      <p style={{ fontSize: 15, color: status === 'error' ? '#f87171' : '#94a3b8' }}>
        {message}
      </p>
      {status === 'error' && (
        <button
          onClick={() => router.replace('/')}
          style={{
            marginTop: 16,
            padding: '10px 24px',
            background: '#334155',
            border: 'none',
            borderRadius: 8,
            color: '#e2e8f0',
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          Back to app
        </button>
      )}
    </div>
  )
}
