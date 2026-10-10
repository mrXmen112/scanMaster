'use client'

import { useState, useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { AdMob, BannerAdSize, BannerAdPosition } from '@capacitor-community/admob'
import { SpeechRecognition } from '@capacitor-community/speech-recognition'
import { FilePicker } from '@capawesome/capacitor-file-picker'
import { FileOpener } from '@capacitor-community/file-opener'
import { Share } from '@capacitor/share'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { getEffectiveBannerId } from '@/lib/ads/config'
import { toast } from 'sonner'
import { ArrowLeft, CheckCircle2, XCircle, Beaker, Play } from 'lucide-react'
import { buildApiUrl, getApiBaseUrl } from '@/lib/api-base-url'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'

const StatusRow = ({ label, value }: { label: string; value: boolean }) => (
  <div className="flex justify-between items-center py-2 border-b border-white/5">
    <span className="text-sm text-foreground">{label}</span>
    {value ? (
      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
    ) : (
      <XCircle className="w-4 h-4 text-red-500" />
    )}
  </div>
)

export default function Diagnostics({ onBack }: { onBack: () => void }) {
  const [logs, setLogs] = useState<string[]>([])
  
  const [openrouterKey, setOpenrouterKey] = useState<boolean>(false)
  const [admobAvail, setAdmobAvail] = useState<boolean>(false)
  const [speechAvail, setSpeechAvail] = useState<boolean>(false)
  const [pickerAvail, setPickerAvail] = useState<boolean>(false)
  const [openerAvail, setOpenerAvail] = useState<boolean>(false)
  const [fsAvail, setFsAvail] = useState<boolean>(false)
  const [shareAvail, setShareAvail] = useState<boolean>(false)
  const [apiBaseUrlPresent, setApiBaseUrlPresent] = useState<boolean>(false)
  
  const [openrouterModel, setOpenrouterModel] = useState<string>('openrouter/free')
  const [providerStatus, setProviderStatus] = useState<string>('Detecting...')

  const log = (msg: string) => {
    console.log('[Diagnostics]', msg)
    setLogs((prev) => [msg, ...prev].slice(0, 50))
  }

  const admobAppId = process.env.NEXT_PUBLIC_ADMOB_APP_ID || 'Missing (or fallback test ID)'
  const configuredBaseUrl = getApiBaseUrl() || process.env.NEXT_PUBLIC_API_BASE_URL || ''

  useEffect(() => {
    // Initial checks
    setAdmobAvail(Capacitor.isPluginAvailable('AdMob'))
    setSpeechAvail(Capacitor.isPluginAvailable('SpeechRecognition'))
    setPickerAvail(Capacitor.isPluginAvailable('FilePicker'))
    setOpenerAvail(Capacitor.isPluginAvailable('FileOpener'))
    setFsAvail(Capacitor.isPluginAvailable('Filesystem'))
    setShareAvail(Capacitor.isPluginAvailable('Share'))
    setApiBaseUrlPresent(!!configuredBaseUrl)

    // Securely query backend for AI key presence and model probe
    const fetchAiHealth = async () => {
      try {
        const url = buildApiUrl('/api/health/ai?probe=true')
        const res = await fetchWithTimeout(url, { method: 'GET' }, 10000)
        if (res.ok) {
          const data = await res.json()
          setOpenrouterKey(!!data.checks?.aiKeys?.OpenRouter?.configured)
          if (data.checks?.aiConfig?.model) setOpenrouterModel(data.checks.aiConfig.model)
          if (data.providerStatus) {
            setProviderStatus(data.providerStatus)
          }
          if (!data.providerStatus && data.checks?.aiKeys?.anyConfigured) {
            setProviderStatus('OpenRouter configured')
          }
          log(`AI health check loaded. Status: ${data.summary || 'configured'}`)
        } else {
          log(`AI health check returned status ${res.status}`)
        }
      } catch (err: any) {
        log(`AI health check query failed: ${err.message}`)
      }
    }

    fetchAiHealth()
    log('Diagnostics initialized.')
  }, [configuredBaseUrl])

  const testBackendHealth = async () => {
    const requestUrl = buildApiUrl('/api/health')
    log(`------------------------------`)
    log(`Testing secure backend health...`)
    log(`Request URL: ${requestUrl}`)
    log(`Base URL Configured: ${configuredBaseUrl || 'None (Relative)'}`)
    
    try {
      const response = await fetchWithTimeout(requestUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      }, 10000)

      log(`Status Code: ${response.status}`)
      
      const body = await response.json()
      log(`Response Body: ${JSON.stringify(body)}`)
      
      if (response.ok && body.ok) {
        log(`Success: Health check returned ok=true!`)
        toast.success('Backend health check success!')
      } else {
        log(`Error: Health check response negative.`)
        toast.error('Health check failed')
      }
    } catch (err: any) {
      const errorType = err instanceof TypeError ? 'Network/CORS/Canceled' : err.name || 'Error'
      log(`Error Type: ${errorType}`)
      log(`Error Message: ${err.message}`)
      toast.error(`Health Test Failed: ${err.message}`)
    }
  }

  const testSummaryRoute = async () => {
    const requestUrl = buildApiUrl('/api/ai/summary')
    log(`------------------------------`)
    log(`Testing secure POST /api/ai/summary...`)
    log(`Request URL: ${requestUrl}`)
    
    try {
      const response = await fetchWithTimeout(requestUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: 'Scan Master AI connectivity testing mock document. Hello secure backend!',
          mode: 'short'
        })
      }, 15000)

      log(`Status Code: ${response.status}`)
      
      const body = await response.json()
      log(`Response Body: ${JSON.stringify(body)}`)
      
      if (response.ok && body.summary) {
        log(`Success! AI Summary: ${body.summary.substring(0, 80)}...`)
        toast.success('Secure AI Summary test success!')
      } else {
        log(`Error: Response body does not contain summary.`)
        toast.error('AI Summary Route Failed')
      }
    } catch (err: any) {
      const errorType = err instanceof TypeError ? 'Network/CORS/Canceled' : err.name || 'Error'
      log(`Error Type: ${errorType}`)
      log(`Error Message: ${err.message}`)
      toast.error(`AI Summary Test Failed: ${err.message}`)
    }
  }

  const testAdMob = async () => {
    log('Testing AdMob Banner...')
    try {
      if (!Capacitor.isNativePlatform()) {
        throw new Error('Not on native platform.')
      }
      await AdMob.initialize()
      log('AdMob Initialized')
      
      const bannerId = getEffectiveBannerId() || 'ca-app-pub-3940256099942544/6300978111' // Fallback to Google Test ID just in case
      log(`Showing banner with ID: ${bannerId}`)

      await AdMob.showBanner({
        adId: bannerId,
        adSize: BannerAdSize.BANNER,
        position: BannerAdPosition.BOTTOM_CENTER,
        margin: 0,
        isTesting: true,
      })
      log('Banner Ad loaded successfully')
      toast.success('Banner Ad loaded')
      
      // Auto hide after 5 seconds for convenience
      setTimeout(() => {
        AdMob.hideBanner().catch(() => {})
        log('Banner auto-hidden after 5s')
      }, 5000)

    } catch (err: any) {
      log(`AdMob Error: ${err.message}`)
      toast.error(`AdMob Error: ${err.message}`)
    }
  }

  const testSpeech = async () => {
    log('Testing Speech Recognition...')
    try {
      if (!Capacitor.isNativePlatform()) throw new Error('Not on native platform.')
      
      const { available } = await SpeechRecognition.available()
      if (!available) throw new Error('Speech Recognition engine not available on device.')

      const hasPerms = await SpeechRecognition.checkPermissions()
      if (hasPerms.speechRecognition !== 'granted') {
        const req = await SpeechRecognition.requestPermissions()
        if (req.speechRecognition !== 'granted') {
          throw new Error('Microphone permission denied.')
        }
      }

      log('Starting speech recognition...')
      await SpeechRecognition.start({
        language: 'en-US',
        maxResults: 1,
        prompt: 'Say something (Diagnostics test)',
        partialResults: false,
        popup: true,
      })

      SpeechRecognition.addListener('partialResults', (data: any) => {
        if (data.matches && data.matches.length > 0) {
          log(`Speech recognized: ${data.matches[0]}`)
          SpeechRecognition.stop().catch(() => {})
        }
      })
      toast.success('Listening for speech...')
    } catch (err: any) {
      log(`Speech Error: ${err.message}`)
      toast.error(`Speech Error: ${err.message}`)
    }
  }

  const testPickPdf = async () => {
    log('Testing File Picker...')
    try {
      const result = await FilePicker.pickFiles({
        types: ['application/pdf'],
        multiple: false,
        readData: true,
      })
      if (result.files && result.files.length > 0) {
        log(`Picked file: ${result.files[0].name} (${result.files[0].size} bytes)`)
        toast.success(`Picked: ${result.files[0].name}`)
      } else {
        log('File picking cancelled by user.')
        toast.info('Picker canceled by user, not error.')
      }
    } catch (err: any) {
      if (err.message && err.message.toLowerCase().includes('canceled')) {
        log('Picker canceled by user.')
        toast.info('Picker canceled by user, not error.')
      } else {
        log(`Picker Error: ${err.message}`)
        toast.error(`Picker Error: ${err.message}`)
      }
    }
  }

  const testOpenPdf = async () => {
    log('Testing File Opener (creating dummy PDF)...')
    try {
      // Create a tiny dummy text file with .pdf extension to test the opener intent
      const fileName = 'diagnostics_test.pdf'
      const { uri } = await Filesystem.writeFile({
        path: fileName,
        data: 'JVBERi0xLjcKCjEgMCBvYmogICUgZW50cnkgcG9pbnQKPDwKICAvVHlwZSAvQ2F0YWxvZwogIC9QYWdlcyAyIDAgUgo+PgplbmRvYmoKCjIgMCBvYmoKPDwKICAvVHlwZSAvUGFnZXMKICAvTWVkaWFCb3ggWyAwIDAgMjAwIDIwMCBdCiAgL0NvdW50IDEKICAvS2lkcyBbIDMgMCBSIF0KPj4KZW5kb2JqCgozIDAgb2JqCjw8CiAgL1R5cGUgL1BhZ2UKICAvUGFyZW50IDIgMCBSCiAgL1Jlc291cmNlcyA8PAogICAgL0ZvbnQgPDwKICAgICAgL0YxIDQgMCBSCgkvRm9udDIgNSAwIFIKICAgID4+CiAgPj4KICAvQ29udGVudHMgNiAwIFIKPj4KZW5kb2JqCgo0IDAgb2JqCjw8CiAgL1R5cGUgL0ZvbnQKICAvU3VidHlwZSAvVHlwZTEKICAvQmFzZUZvbnQgL1RpbWVzLVJvbWFuCj4+CmVuZG9iagoKNSAwIG9iago8PAogIC9UeXBlIC9Gb250CiAgL1N1YnR5cGUgL1R5cGUxCiAgL0Jhc2VGb250IC9IZWx2ZXRpY2EKPj4KZW5kb2JqCgo2IDAgb2JqCjw8CiAgL0xlbmd0aCA3MwA+PgpzdHJlYW0KICBCVAogICAgL0YxIDE4IFRmCiAgICAwIDAgMCByZwogICAgMCAxMDAgVGQKICAgIChIZWxsbyBXb3JsZCkgVGoKICBFVApFTkRTVFJFQU0KZW5kb2JqCgp4cmVmCjAgNwowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMTAgMDAwMDAgbiAKMDAwMDAwMDA2OCAwMDAwMCBuIAowMDAwMDAwMTU1IDAwMDAwIG4gCjAwMDAwMDAyOTYgMDAwMDAgbiAKMDAwMDAwMDM4NCAwMDAwMCBuIAowMDAwMDAwNDcyIDAwMDAwIG4gCnRyYWlsZXIKPDwKICAvU2l6ZSA3CiAgL1Jvb3QgMSAwIFIKPj4Kc3RhcnR4cmVmCjU5NAolJUVPRgo=', // Minimal valid PDF Base64
        directory: Directory.Cache,
      })

      log(`File created at URI: ${uri}`)
      
      await FileOpener.open({
        filePath: uri,
        contentType: 'application/pdf',
      })
      log('File Opener triggered successfully.')
    } catch (err: any) {
      log(`Opener Error: ${err.message}`)
      toast.error(`Opener Error: ${err.message}`)
    }
  }

  const testSharePdf = async () => {
    log('Testing Share (creating dummy PDF)...')
    try {
      const fileName = 'share_test.pdf'
      const { uri } = await Filesystem.writeFile({
        path: fileName,
        data: 'JVBERi0xLjQKJcOkw7zDtsOfCjIgMCBvYmoKPDwvTGVuZ3RoIDM+PgpzdHJlYW0KLi4uCmVuZHN0cmVhbQplbmRvYmoK', // Dummy PDF Base64
        directory: Directory.Cache,
      })

      log(`Sharing file URI: ${uri}`)
      
      await Share.share({
        title: 'Diagnostic Test',
        text: 'This is a test share from ScanMaster AI',
        url: uri,
        dialogTitle: 'Share Test PDF'
      })
      log('Share triggered successfully.')
    } catch (err: any) {
      if (err.message && err.message.toLowerCase().includes('cancel')) {
        log('Share canceled by user.')
        toast.info('Share canceled by user, not error.')
      } else {
        log(`Share Error: ${err.message}`)
        toast.error(`Share Error: ${err.message}`)
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl overflow-y-auto pb-20">
      <div className="px-4 py-4 max-w-md mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={onBack} className="p-2 -ml-2 rounded-xl hover:bg-white/10 transition-colors">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <div>
            <h2 className="text-lg font-bold text-foreground">Diagnostics</h2>
            <p className="text-xs font-mono text-primary/80">Version: Test Build 13</p>
          </div>
        </div>

        <div className="glass-card p-4 mb-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">System Status</h3>
          <StatusRow label="OpenRouter Configured (Backend)" value={openrouterKey} />
          <StatusRow label="AdMob plugin available" value={admobAvail} />
          <StatusRow label="Speech plugin available" value={speechAvail} />
          <StatusRow label="FilePicker plugin available" value={pickerAvail} />
          <StatusRow label="FileOpener plugin available" value={openerAvail} />
          <StatusRow label="Filesystem plugin available" value={fsAvail} />
          <StatusRow label="Share plugin available" value={shareAvail} />
          <StatusRow label="AI Backend URL defined" value={apiBaseUrlPresent} />
        </div>

        <div className="glass-card p-4 mb-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Variables</h3>
          <div className="text-xs text-muted-foreground space-y-1">
            <p><strong>OpenRouter Model:</strong> {openrouterModel}</p>
            <p><strong>Provider Status:</strong> <span className="font-mono text-primary">{providerStatus}</span></p>
            <p><strong>AdMob App ID:</strong> {admobAppId}</p>
            <p><strong>Test Banner ID:</strong> {getEffectiveBannerId()}</p>
            <p><strong>AI Backend URL:</strong> <span className="font-mono text-primary">{configuredBaseUrl || 'Not configured'}</span></p>
          </div>
        </div>

        <div className="glass-card p-4 mb-4 space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">AI Backend Diagnostics</h3>
          
          <button onClick={testBackendHealth} className="w-full flex items-center justify-between p-3 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors">
            <span className="text-sm font-medium text-foreground flex items-center gap-2"><Beaker className="w-4 h-4 text-emerald-500" /> Test Backend Health</span>
            <Play className="w-4 h-4 text-emerald-500" />
          </button>
          
          <button onClick={testSummaryRoute} className="w-full flex items-center justify-between p-3 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 transition-colors">
            <span className="text-sm font-medium text-foreground flex items-center gap-2"><Beaker className="w-4 h-4 text-indigo-500" /> Test AI Summary Route</span>
            <Play className="w-4 h-4 text-indigo-500" />
          </button>
          
          <button onClick={testAdMob} className="w-full flex items-center justify-between p-3 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 transition-colors">
            <span className="text-sm font-medium text-foreground flex items-center gap-2"><Beaker className="w-4 h-4 text-blue-500" /> Show Test Banner</span>
            <Play className="w-4 h-4 text-blue-500" />
          </button>
          
          <button onClick={testPickPdf} className="w-full flex items-center justify-between p-3 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 transition-colors">
            <span className="text-sm font-medium text-foreground flex items-center gap-2"><Beaker className="w-4 h-4 text-purple-500" /> Pick PDF Test</span>
            <Play className="w-4 h-4 text-purple-500" />
          </button>

          <button onClick={testOpenPdf} className="w-full flex items-center justify-between p-3 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 transition-colors">
            <span className="text-sm font-medium text-foreground flex items-center gap-2"><Beaker className="w-4 h-4 text-orange-500" /> Open PDF Test</span>
            <Play className="w-4 h-4 text-orange-500" />
          </button>

          <button onClick={testSharePdf} className="w-full flex items-center justify-between p-3 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors">
            <span className="text-sm font-medium text-foreground flex items-center gap-2"><Beaker className="w-4 h-4 text-emerald-500" /> Share PDF Test</span>
            <Play className="w-4 h-4 text-emerald-500" />
          </button>

          <button onClick={testSpeech} className="w-full flex items-center justify-between p-3 rounded-lg bg-pink-500/10 hover:bg-pink-500/20 transition-colors">
            <span className="text-sm font-medium text-foreground flex items-center gap-2"><Beaker className="w-4 h-4 text-pink-500" /> Test Speech</span>
            <Play className="w-4 h-4 text-pink-500" />
          </button>
        </div>

        <div className="glass-card p-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Runtime Logs</h3>
          <div className="h-40 overflow-y-auto font-mono text-[10px] text-muted-foreground space-y-1">
            {logs.length === 0 ? (
              <span className="italic">No logs yet...</span>
            ) : (
              logs.map((l, i) => (
                <div key={i} className="border-b border-white/5 pb-1">
                  {l}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
