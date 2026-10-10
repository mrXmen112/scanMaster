import { create } from 'zustand'

export type ToolView = 
  | 'home'
  | 'text-to-pdf'
  | 'image-to-pdf'
  | 'scan-to-pdf'
  | 'pdf-editor'
  | 'compress-pdf'
  | 'merge-pdf'
  | 'split-pdf'
  | 'translate'
  | 'ocr'
  | 'speech-to-text'
  | 'zip-export'
  | 'password-protect'
  | 'password-remove'
  | 'e-signature'
  | 'ai-summary'
  | 'smart-crop'
  | 'handwriting-to-text'
  | 'business-card-scanner'
  | 'background-cleaner'
  | 'screenshot-editor'
  | 'tools'
  | 'files'
  | 'ai'
  | 'profile'
  | 'premium'
  | 'auth'

export type FileCategory = 'recent' | 'scanned' | 'edited' | 'zip' | 'favorites' | 'trash' | 'folders'

export interface StoredFile {
  id: string
  name: string
  type: 'pdf' | 'image' | 'zip' | 'text'
  size: number
  createdAt: Date
  category: FileCategory[]
  favorite: boolean
  dataUrl?: string
}

interface AppState {
  activeTab: 'home' | 'tools' | 'files' | 'ai' | 'profile'
  activeView: ToolView
  previousView: ToolView | null
  files: StoredFile[]
  theme: 'dark' | 'light'

  setActiveTab: (tab: AppState['activeTab']) => void
  setActiveView: (view: ToolView) => void
  goBack: () => void
  addFile: (file: StoredFile) => void
  removeFile: (id: string) => void
  toggleFavorite: (id: string) => void
  renameFile: (id: string, name: string) => void
  toggleTheme: () => void
}

export const useAppStore = create<AppState>((set, get) => ({
  activeTab: 'home',
  activeView: 'home',
  previousView: null,
  files: [],
  theme: 'dark',

  setActiveTab: (tab) => {
    const current = get()
    // Idempotent: no-op if already on this tab
    if (current.activeTab === tab) return
    const viewMap: Record<string, ToolView> = {
      home: 'home',
      tools: 'tools',
      files: 'files',
      ai: 'ai',
      profile: 'profile',
    }
    set({ activeTab: tab, activeView: viewMap[tab] || 'home', previousView: current.activeView })
  },

  setActiveView: (view) => {
    const current = get()
    // Idempotent: no-op if already on this view
    if (current.activeView === view) return
    let tab: AppState['activeTab'] = 'home'
    if (view === 'home') tab = 'home'
    else if (view === 'tools') tab = 'tools'
    else if (view === 'files') tab = 'files'
    else if (view === 'ai') tab = 'ai'
    else if (view === 'profile' || view === 'premium') tab = 'profile'
    else tab = 'tools'

    set({ activeView: view, previousView: current.activeView, activeTab: tab })
  },

  goBack: () => {
    const { previousView, activeView } = get()
    if (previousView) {
      // Avoid going back to same view
      if (previousView === activeView) {
        set({ previousView: null })
        return
      }
      const tab = previousView === 'home' ? 'home' : 
                  previousView === 'tools' ? 'tools' :
                  previousView === 'files' ? 'files' :
                  previousView === 'ai' ? 'ai' : 
                  previousView === 'profile' || previousView === 'premium' ? 'profile' : 'tools'
      set({ activeView: previousView, previousView: null, activeTab: tab })
    } else {
      if (activeView === 'home') return // Already home, no-op
      set({ activeView: 'home', activeTab: 'home' })
    }
  },

  addFile: (file) => set((state) => ({ files: [file, ...state.files] })),
  removeFile: (id) => set((state) => ({ files: state.files.filter((f) => f.id !== id) })),
  toggleFavorite: (id) =>
    set((state) => ({
      files: state.files.map((f) =>
        f.id === id ? { ...f, favorite: !f.favorite } : f
      ),
    })),
  renameFile: (id, name) =>
    set((state) => ({
      files: state.files.map((f) => (f.id === id ? { ...f, name } : f)),
    })),
  toggleTheme: () =>
    set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
}))
