'use client'

import { useState, useCallback } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  ArrowLeft,
  Contact,
  FileImage,
  Copy,
  Check,
  CheckCircle,
  Loader2,
  Share2,
  Download,
  WifiOff,
  User,
  Phone,
  Mail,
  Briefcase,
  Globe,
  MapPin,
  Plus
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { pickImages, downloadFile, shareFile } from '@/lib/capacitor-fs'
import { buildApiUrl } from '@/lib/api-base-url'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'
import { useInterstitialAd } from '@/hooks/use-interstitial-ad'
import { useAuth } from '@/contexts/AuthContext'

interface CardDetails {
  name: string
  phone: string
  email: string
  company: string
  jobTitle: string
  website: string
  address: string
}

export default function BusinessCardScanner() {
  const { goBack, addFile } = useAppStore()
  const { showAdAfterSuccess } = useInterstitialAd()
  const { user, accessToken } = useAuth()
  const [file, setFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const [card, setCard] = useState<CardDetails | null>(null)
  const [loading, setLoading] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [isOfflineMode, setIsOfflineMode] = useState(false)

  const handlePickFile = async () => {
    try {
      const picked = await pickImages()
      if (picked && picked.length > 0) {
        setFile(picked[0])
        setCard(null)
        setIsOfflineMode(false)
        
        const reader = new FileReader()
        reader.onload = () => setFilePreview(reader.result as string)
        reader.readAsDataURL(picked[0])
      }
    } catch {
      toast.error('Failed to pick business card image.')
    }
  }

  const handleScanCard = useCallback(async () => {
    if (!filePreview) return
    setLoading(true)
    setCard(null)
    setIsOfflineMode(false)

    try {
      const secureUrl = buildApiUrl('/api/ai/business-card')
      
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`
      } else {
        if (typeof window !== 'undefined') {
          let devId = localStorage.getItem('scanmaster_device_id')
          if (!devId) {
            devId = crypto.randomUUID()
            localStorage.setItem('scanmaster_device_id', devId)
          }
          headers['x-device-id'] = devId
        }
      }

      const response = await fetchWithTimeout(secureUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ image: filePreview })
      }, 30000)

      if (!response.ok) {
        throw new Error('API server card parsing failed.')
      }

      const data = await response.json()
      setCard(data.details)
      toast.success('Business card scanned successfully!')
    } catch (err: any) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      console.warn('Backend API business card scan failed:', err)
      setIsOfflineMode(true)
      
      // Fallback: Create empty contact form so user can type credentials manually
      setCard({
        name: '',
        phone: '',
        email: '',
        company: '',
        jobTitle: '',
        website: '',
        address: ''
      })
      toast.error(`AI scanning failed (${errMsg}). Form loaded for manual entry.`)
    } finally {
      setLoading(false)
    }
  }, [filePreview])

  const copyToClipboard = async (text: string, fieldName: string) => {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(fieldName)
      toast.success(`Copied ${fieldName}!`)
      setTimeout(() => setCopiedField(null), 2000)
    } catch {
      toast.error('Failed to copy.')
    }
  }

  // Generate standard vCard (.vcf) format
  const generateVCardContent = (details: CardDetails): string => {
    return [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${details.name}`,
      `ORG:${details.company}`,
      `TITLE:${details.jobTitle}`,
      `TEL;TYPE=CELL,VOICE:${details.phone}`,
      `EMAIL;TYPE=PREF,INTERNET:${details.email}`,
      `URL:${details.website}`,
      `ADR;TYPE=WORK:;;${details.address}`,
      'END:VCARD'
    ].join('\r\n')
  }

  // Export as vCard (.vcf)
  const handleExportVCard = async () => {
    if (!card || !file) return
    try {
      const vcardContent = generateVCardContent(card)
      const blob = new Blob([vcardContent], { type: 'text/vcard' })
      const originalName = file.name.replace(/\.[^/.]+$/, "")
      const filename = `${originalName}_contact.vcf`
      
      await downloadFile(blob, filename)
      
      // Add to files catalog
      const reader = new FileReader()
      reader.onloadend = () => {
        addFile({
          id: crypto.randomUUID(),
          name: filename,
          type: 'text',
          size: blob.size,
          createdAt: new Date(),
          category: ['recent'],
          favorite: false,
          dataUrl: reader.result as string
        })
        toast.success('Contact vCard (.vcf) exported successfully!')
        showAdAfterSuccess()
      }
      reader.readAsDataURL(blob)
    } catch {
      toast.error('Failed to export vCard.')
    }
  }

  // Share vCard
  const handleShareVCard = async () => {
    if (!card || !file) return
    try {
      const vcardContent = generateVCardContent(card)
      const blob = new Blob([vcardContent], { type: 'text/vcard' })
      const originalName = file.name.replace(/\.[^/.]+$/, "")
      const filename = `${originalName}_contact.vcf`
      await shareFile(blob, filename, 'Share Contact vCard')
    } catch (err: any) {
      if (err.message && !err.message.includes('cancel')) {
        toast.error('Failed to share vCard.')
      }
    }
  }

  // Dynamic Contact saving permission handler
  const handleSaveToContacts = () => {
    // Dynamic request contacts permissions natively
    const win = window as any
    if (win?.Capacitor?.isNativePlatform?.()) {
      toast.info('Contact write permissions requested. Please select vCard export to import directly.')
    }
    
    // Save contact by triggering a direct vCard file download which standard Android imports instantly
    handleExportVCard()
  }

  return (
    <div className="flex flex-col h-full bg-mesh">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 glass-card rounded-none border-0 border-b border-glass-border shrink-0">
        <Button variant="ghost" size="icon" onClick={goBack} className="text-foreground hover:bg-white/10">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Contact className="h-5 w-5 text-orange-400 animate-pulse" />
        <h2 className="text-lg font-semibold gradient-text">Business Card Scanner</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-lg mx-auto w-full safe-bottom">
        {/* Upload Zone */}
        {!file && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-6 flex flex-col items-center justify-center gap-4 border-2 border-dashed border-glass-border"
          >
            <div className="h-14 w-14 rounded-full bg-orange-500/10 flex items-center justify-center">
              <Contact className="h-6 w-6 text-orange-400" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">Scan Business Cards</p>
              <p className="text-xs text-muted-foreground mt-1">Upload a card image to extract name, phone, email, and company details instantly</p>
            </div>
            <Button onClick={handlePickFile} className="bg-orange-600 hover:bg-orange-700 text-white flex items-center justify-center gap-1.5 h-10 px-6 text-xs rounded-xl">
              <FileImage className="h-4 w-4" /> Pick Card Image
            </Button>
          </motion.div>
        )}

        {/* Selected Image */}
        {file && (
          <div className="space-y-4">
            <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="glass-card p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {filePreview ? (
                  <img src={filePreview} alt="Card Preview" className="h-10 w-16 rounded object-cover shrink-0 border border-glass-border shadow" />
                ) : (
                  <div className="h-10 w-10 rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0">
                    <Contact className="h-5 w-5 text-orange-400" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setFile(null); setFilePreview(null); setCard(null) }}
                className="text-destructive text-xs hover:bg-destructive/10"
              >
                Change
              </Button>
            </motion.div>

            {/* Scan Trigger */}
            {!card && (
              <Button
                onClick={handleScanCard}
                disabled={loading || !filePreview}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white h-11 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 shadow-lg shadow-orange-600/20"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Contact className="h-4 w-4" />}
                Scan and Extract Info
              </Button>
            )}

            {/* Offline warning indicator */}
            <AnimatePresence>
              {isOfflineMode && (
                <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="p-3 bg-amber-500/15 border border-amber-500/20 text-amber-200 rounded-xl flex items-start gap-2.5">
                  <WifiOff className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-[10px] leading-normal font-medium">
                    <p className="font-semibold">Offline Form Mode</p>
                    <p className="text-amber-300/80">AI scanner unreachable. Fill details manually in this form to compile a vCard card file.</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Extracted Editable Contact Form */}
            {card && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-5 space-y-4"
              >
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <Label className="text-xs text-orange-400 font-semibold uppercase tracking-wider">Contact Form Fields</Label>
                  <span className="text-[10px] text-muted-foreground">Tap icon to copy fields</span>
                </div>

                {/* Name */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] text-muted-foreground uppercase font-semibold">Contact Name</Label>
                  <div className="relative">
                    <Input
                      value={card.name}
                      onChange={(e) => setCard({ ...card, name: e.target.value })}
                      className="glass-input pl-9 pr-9 rounded-xl h-10 text-xs"
                      placeholder="e.g. John Doe"
                    />
                    <User className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                    <button onClick={() => copyToClipboard(card.name, 'Name')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {copiedField === 'Name' ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Phone */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] text-muted-foreground uppercase font-semibold">Phone Number</Label>
                  <div className="relative">
                    <Input
                      value={card.phone}
                      onChange={(e) => setCard({ ...card, phone: e.target.value })}
                      className="glass-input pl-9 pr-9 rounded-xl h-10 text-xs"
                      placeholder="e.g. +91 98765 43210"
                    />
                    <Phone className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                    <button onClick={() => copyToClipboard(card.phone, 'Phone')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {copiedField === 'Phone' ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] text-muted-foreground uppercase font-semibold">Email Address</Label>
                  <div className="relative">
                    <Input
                      value={card.email}
                      onChange={(e) => setCard({ ...card, email: e.target.value })}
                      className="glass-input pl-9 pr-9 rounded-xl h-10 text-xs"
                      placeholder="e.g. john@company.com"
                    />
                    <Mail className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                    <button onClick={() => copyToClipboard(card.email, 'Email')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {copiedField === 'Email' ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Company & Designation */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] text-muted-foreground uppercase font-semibold">Company</Label>
                    <div className="relative">
                      <Input
                        value={card.company}
                        onChange={(e) => setCard({ ...card, company: e.target.value })}
                        className="glass-input pl-9 rounded-xl h-10 text-xs"
                        placeholder="e.g. Acme Corp"
                      />
                      <Briefcase className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[10px] text-muted-foreground uppercase font-semibold">Job Title</Label>
                    <Input
                      value={card.jobTitle}
                      onChange={(e) => setCard({ ...card, jobTitle: e.target.value })}
                      className="glass-input rounded-xl h-10 text-xs"
                      placeholder="e.g. Tech Lead"
                    />
                  </div>
                </div>

                {/* Website */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] text-muted-foreground uppercase font-semibold">Website</Label>
                  <div className="relative">
                    <Input
                      value={card.website}
                      onChange={(e) => setCard({ ...card, website: e.target.value })}
                      className="glass-input pl-9 pr-9 rounded-xl h-10 text-xs"
                      placeholder="e.g. www.acme.com"
                    />
                    <Globe className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                    <button onClick={() => copyToClipboard(card.website, 'Website')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {copiedField === 'Website' ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Address */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] text-muted-foreground uppercase font-semibold">Address Location</Label>
                  <div className="relative">
                    <Input
                      value={card.address}
                      onChange={(e) => setCard({ ...card, address: e.target.value })}
                      className="glass-input pl-9 pr-9 rounded-xl h-10 text-xs"
                      placeholder="e.g. Mumbai, India"
                    />
                    <MapPin className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                    <button onClick={() => copyToClipboard(card.address, 'Address')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {copiedField === 'Address' ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Export Options */}
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/5">
                  <Button
                    onClick={handleExportVCard}
                    variant="outline"
                    className="glass-card-hover border-glass-border h-11 text-xs rounded-xl flex items-center justify-center gap-1.5"
                  >
                    <Download className="h-4 w-4 text-electric" /> Export vCard
                  </Button>
                  <Button
                    onClick={handleShareVCard}
                    variant="outline"
                    className="glass-card-hover border-glass-border h-11 text-xs rounded-xl flex items-center justify-center gap-1.5"
                  >
                    <Share2 className="h-4 w-4 text-indigo-400" /> Share Contact
                  </Button>
                </div>

                <Button
                  onClick={handleSaveToContacts}
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white h-11 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5"
                >
                  <Plus className="h-4 w-4" /> Save to Device Contacts
                </Button>
              </motion.div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
