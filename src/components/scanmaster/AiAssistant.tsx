'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Sparkles, BookOpen, PenLine, CheckCircle, Languages, Briefcase, WifiOff } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { fetchWithTimeout, isServiceUnavailableError } from '@/lib/fetch-with-timeout'
import { buildApiUrl } from '@/lib/api-base-url'

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
}

const quickActions = [
  { label: 'Summarize', icon: BookOpen, prompt: 'Summarize this document for me' },
  { label: 'Explain', icon: Sparkles, prompt: 'Explain this document in simple terms' },
  { label: 'Rewrite', icon: PenLine, prompt: 'Rewrite this content to improve clarity' },
  { label: 'Grammar', icon: CheckCircle, prompt: 'Check the grammar in this document' },
  { label: 'Translate', icon: Languages, prompt: 'Translate this document to another language' },
  { label: 'Format', icon: Briefcase, prompt: 'Format this document professionally' },
]

export default function AiAssistant() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [serviceDown, setServiceDown] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isLoading])

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetchWithTimeout(buildApiUrl('/api/ai-chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text.trim(), history: messages.filter(m => m.role !== 'system') }),
      }, 10000) // 10-second timeout for AI chat

      let data: { response?: string; reply?: string; error?: string }
      try {
        data = await response.json()
      } catch {
        throw new Error('Invalid response from AI service')
      }

      if (data.error) {
        throw new Error(data.error)
      }

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.reply || data.response || 'I apologize, but I could not process your request. Please try again.',
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, assistantMessage])
      setServiceDown(false)
    } catch (err) {
      const errMsg = (err as Error)?.message || ''
      const isDown = isServiceUnavailableError(err)
      setServiceDown(isDown)

      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: isDown
          ? 'AI service is temporarily unavailable. Your camera scanner and PDF tools still work — AI features will return shortly.'
          : errMsg || 'I\'m having trouble connecting right now. Please try again.',
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Service down banner */}
      {serviceDown && (
        <div className="flex items-center gap-2 px-4 py-2 bg-yellow-500/10 border-b border-yellow-500/20">
          <WifiOff className="h-4 w-4 text-yellow-500 shrink-0" />
          <p className="text-xs text-yellow-500/80">AI service unavailable. Scanner and PDF tools still work offline.</p>
        </div>
      )}

      {/* Chat Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center electric-glow-sm"
            >
              <Bot className="h-8 w-8 text-primary" />
            </motion.div>
            <div className="text-center">
              <h3 className="text-lg font-bold text-foreground">
                AI Document Assistant
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Ask me anything about your documents
              </p>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 w-full max-w-md mt-4">
              {quickActions.map((action) => {
                const Icon = action.icon
                return (
                  <motion.button
                    key={action.label}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => sendMessage(action.prompt)}
                    className="glass-card-hover p-3 flex flex-col items-center gap-2"
                  >
                    <Icon className="h-5 w-5 text-primary" />
                    <span className="text-xs font-medium text-foreground">
                      {action.label}
                    </span>
                  </motion.button>
                )
              })}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-2 ${
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-md'
                      : msg.role === 'system'
                      ? 'bg-yellow-500/10 text-yellow-200 border border-yellow-500/20 rounded-bl-md'
                      : 'glass-card rounded-bl-md text-foreground'
                  }`}
                >
                  {msg.content}
                </div>
                {msg.role === 'user' && (
                  <div className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                    <User className="h-4 w-4 text-secondary-foreground" />
                  </div>
                )}
              </motion.div>
            ))}

            {/* Loading Dots */}
            <AnimatePresence>
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex gap-2 justify-start"
                >
                  <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                  <div className="glass-card px-4 py-3 rounded-2xl rounded-bl-md">
                    <div className="flex gap-1.5">
                      <motion.div
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1, repeat: Infinity, delay: 0 }}
                        className="w-2 h-2 rounded-full bg-primary"
                      />
                      <motion.div
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
                        className="w-2 h-2 rounded-full bg-primary"
                      />
                      <motion.div
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
                        className="w-2 h-2 rounded-full bg-primary"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>

      {/* Quick Actions when in conversation */}
      {messages.length > 0 && !isLoading && (
        <div className="px-4 pb-2">
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {quickActions.map((action) => {
              const Icon = action.icon
              return (
                <button
                  key={action.label}
                  onClick={() => sendMessage(action.prompt)}
                  className="flex items-center gap-1.5 px-3 py-1.5 glass-card text-xs font-medium text-muted-foreground hover:text-foreground whitespace-nowrap shrink-0 transition-colors"
                >
                  <Icon className="h-3 w-3" />
                  {action.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="px-4 pb-2">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your documents..."
            disabled={isLoading}
            className="flex-1 glass-input px-4 py-2.5 text-sm disabled:opacity-50"
          />
          <motion.button
            type="submit"
            disabled={!input.trim() || isLoading}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center disabled:opacity-50 electric-glow-sm shrink-0"
            aria-label="Send message"
          >
            <Send className="h-4 w-4 text-primary-foreground" />
          </motion.button>
        </form>
      </div>
    </div>
  )
}
