import { ChevronLeft } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'

export default function TermsConditions() {
  const { goBack } = useAppStore()

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      {/* Header */}
      <header className="flex items-center gap-3 p-4 border-b border-white/5 bg-background/95 backdrop-blur-md sticky top-0 z-10 safe-top">
        <button
          onClick={goBack}
          className="p-2 -ml-2 rounded-full hover:bg-white/5 transition-colors text-foreground"
          aria-label="Go back"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">
          Terms & Conditions
        </h1>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 pb-10 space-y-6">
        <p className="text-xs text-muted-foreground">Last updated: 27 May 2026</p>

        <p className="text-sm leading-relaxed text-foreground/90">
          Welcome to ScanMaster. By using this app, you agree to these Terms & Conditions.
        </p>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-primary">Use of the App</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            ScanMaster provides document scanning, PDF tools, OCR, translation, AI summary, handwriting to text, business card scanning and related productivity features.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-primary">User Responsibility</h2>
          <p className="text-sm text-foreground/80 leading-relaxed">You are responsible for:</p>
          <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
            <li>The documents you scan, upload, edit, summarize or share</li>
            <li>Ensuring you have the right to process or share any document</li>
            <li>Verifying important outputs before use</li>
            <li>Using the app lawfully and responsibly</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-primary">AI and OCR Accuracy</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            AI, OCR, translation and document extraction features may not always be accurate. Users must manually verify important information, especially legal, financial, medical, educational or official documents.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-primary">Advertisements</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The app may show advertisements through Google AdMob or other advertising networks.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-primary">Prohibited Use</h2>
          <p className="text-sm text-foreground/80 leading-relaxed">You must not use the app to:</p>
          <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
            <li>Process illegal or harmful content</li>
            <li>Violate someone else's privacy or rights</li>
            <li>Upload documents you are not authorized to use</li>
            <li>Reverse engineer, abuse or attack the app/backend</li>
            <li>Bypass rate limits or security systems</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-primary">Limitation of Liability</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            ScanMaster is provided as a productivity tool. We are not responsible for losses caused by incorrect OCR, translation, AI summaries, deleted files, failed exports, user mistakes, device issues or third-party service failures.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-primary">Third-Party Services</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The app may use third-party services for AI processing, ads, authentication, payments or analytics. These services may have their own terms and policies.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-primary">Changes to the App</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We may update, modify, limit, remove or add features at any time to improve performance, security or user experience.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-primary">Termination</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We may restrict access if a user abuses the app, violates these terms or attempts to bypass security restrictions.
          </p>
        </section>

        <section className="space-y-3 border-t border-white/5 pt-6">
          <h2 className="text-lg font-bold text-primary">Contact Us</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            For questions about these Terms & Conditions, contact:
            <br />
            <a href="mailto:wahid1874254@gmail.com" className="text-primary hover:underline mt-1 block">wahid1874254@gmail.com</a>
          </p>
        </section>
      </div>
    </div>
  )
}
