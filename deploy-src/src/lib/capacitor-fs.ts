import { Filesystem, Directory } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { FileOpener } from '@capacitor-community/file-opener'
import { FilePicker } from '@capawesome/capacitor-file-picker'

/**
 * Helper to convert Blob to Base64
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const dataUrl = reader.result as string
      // Extract the base64 part
      const base64 = dataUrl.split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/**
 * Downloads a file. In Capacitor, it writes to the Documents folder.
 * In Web, it uses the standard <a> tag download.
 */
export async function downloadFile(blob: Blob, filename: string): Promise<void> {
  if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform()) {
    try {
      const base64Data = await blobToBase64(blob)
      await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Documents,
        recursive: true,
      })
    } catch (err) {
      console.error('Failed to download file natively', err)
      throw err
    }
  } else {
    // Web fallback
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }
}

/**
 * Shares a file. In Capacitor, writes to Cache and uses Share plugin.
 * In Web, uses navigator.share or fallbacks to download.
 */
export async function shareFile(blob: Blob, filename: string, title: string = 'Share Document'): Promise<void> {
  if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform()) {
    try {
      const base64Data = await blobToBase64(blob)
      const writeResult = await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Cache,
      })
      await Share.share({
        title,
        url: writeResult.uri,
        dialogTitle: title,
      })
    } catch (err) {
      console.error('Failed to share file natively', err)
      throw err
    }
  } else {
    // Web fallback
    if (navigator.share && navigator.canShare?.({ files: [new File([blob], filename, { type: blob.type })] })) {
      await navigator.share({
        title,
        files: [new File([blob], filename, { type: blob.type })]
      })
    } else {
      // Fallback to download
      downloadFile(blob, filename)
      throw new Error('Share not supported, downloaded instead.')
    }
  }
}

/**
 * Opens a file by using FileOpener plugin natively.
 */
export async function openFile(blob: Blob, filename: string): Promise<void> {
  if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform()) {
    try {
      const base64Data = await blobToBase64(blob)
      const writeResult = await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Cache,
      })
      
      await FileOpener.open({
        filePath: writeResult.uri,
        contentType: blob.type || 'application/pdf',
      })
    } catch (err) {
      console.error('Failed to open file natively', err)
      throw err
    }
  } else {
    // Web fallback
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }
}

/**
 * Shared native picker: Pick a single PDF file (Native + Web)
 */
export async function pickSinglePdf(): Promise<File | null> {
  if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform()) {
    try {
      const result = await FilePicker.pickFiles({
        types: ['application/pdf'],
        multiple: false,
        readData: true,
      })
      if (result.files && result.files.length > 0) {
        const fileData = result.files[0]
        if (fileData.data) {
          const byteCharacters = atob(fileData.data)
          const byteNumbers = new Array(byteCharacters.length)
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i)
          }
          const byteArray = new Uint8Array(byteNumbers)
          const blob = new Blob([byteArray], { type: 'application/pdf' })
          return new File([blob], fileData.name || 'document.pdf', { type: 'application/pdf' })
        }
      }
      return null
    } catch (err: any) {
      if (err.message && err.message.toLowerCase().includes('cancel')) {
        return null
      }
      console.error('Failed to pick single PDF natively', err)
      throw err
    }
  }

  // Web fallback
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/pdf,.pdf'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0] || null
      resolve(file)
    }
    input.click()
  })
}

/**
 * Shared native picker: Pick multiple PDF files (Native + Web)
 */
export async function pickMultiplePdfs(): Promise<File[]> {
  if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform()) {
    try {
      const result = await FilePicker.pickFiles({
        types: ['application/pdf'],
        multiple: true,
        readData: true,
      })
      const files: File[] = []
      if (result.files && result.files.length > 0) {
        for (const fileData of result.files) {
          if (fileData.data) {
            const byteCharacters = atob(fileData.data)
            const byteNumbers = new Array(byteCharacters.length)
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i)
            }
            const byteArray = new Uint8Array(byteNumbers)
            const blob = new Blob([byteArray], { type: 'application/pdf' })
            files.push(new File([blob], fileData.name || 'document.pdf', { type: 'application/pdf' }))
          }
        }
      }
      return files
    } catch (err: any) {
      if (err.message && err.message.toLowerCase().includes('cancel')) {
        return []
      }
      console.error('Failed to pick multiple PDFs natively', err)
      throw err
    }
  }

  // Web fallback
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/pdf,.pdf'
    input.multiple = true
    input.onchange = (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || [])
      resolve(files)
    }
    input.click()
  })
}

/**
 * Shared native picker: Pick one or more images (Native + Web)
 */
export async function pickImages(): Promise<File[]> {
  if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform()) {
    try {
      const result = await FilePicker.pickFiles({
        types: ['image/jpeg', 'image/png', 'image/webp'],
        multiple: true,
        readData: true,
      })
      const files: File[] = []
      if (result.files && result.files.length > 0) {
        for (const fileData of result.files) {
          if (fileData.data) {
            const byteCharacters = atob(fileData.data)
            const byteNumbers = new Array(byteCharacters.length)
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i)
            }
            const byteArray = new Uint8Array(byteNumbers)
            const mime = fileData.mimeType || 'image/jpeg'
            const blob = new Blob([byteArray], { type: mime })
            files.push(new File([blob], fileData.name || 'image.jpg', { type: mime }))
          }
        }
      }
      return files
    } catch (err: any) {
      if (err.message && err.message.toLowerCase().includes('cancel')) {
        return []
      }
      console.error('Failed to pick images natively', err)
      throw err
    }
  }

  // Web fallback
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/jpeg,image/png,image/webp,image/jpg'
    input.multiple = true
    input.onchange = (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || [])
      resolve(files)
    }
    input.click()
  })
}

/**
 * Aliases as requested
 */
export async function openPdfFile(blob: Blob, filename: string): Promise<void> {
  return openFile(blob, filename)
}

export async function sharePdfFile(blob: Blob, filename: string): Promise<void> {
  return shareFile(blob, filename)
}
