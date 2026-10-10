import { ChevronLeft } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'

export default function PrivacyPolicy() {
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
          Privacy Policy
        </h1>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 pb-10 space-y-6">
        <p className="text-xs text-muted-foreground">Last updated: 27 May 2026</p>

        <p className="text-sm leading-relaxed text-foreground/90">
          ScanMaster is a document scanner and PDF productivity app developed to help users scan, create, edit, summarize and manage documents.
        </p>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-primary">Information We Collect</h2>
          <p className="text-sm text-foreground/80 leading-relaxed">ScanMaster may collect or process the following information depending on the features you use:</p>
          
          <div className="space-y-4 mt-4">
            <div>
              <h3 className="font-semibold text-sm text-foreground">1. Documents and Files</h3>
              <p className="text-sm text-muted-foreground mt-1">When you scan, import, edit, summarize or process a document, the app may access the selected file or scanned image to perform the requested action.</p>
            </div>
            <div>
              <h3 className="font-semibold text-sm text-foreground">2. Camera Access</h3>
              <p className="text-sm text-muted-foreground mt-1">The app uses your device camera only to scan documents, business cards, handwritten notes or similar content.</p>
            </div>
            <div>
              <h3 className="font-semibold text-sm text-foreground">3. Storage/File Access</h3>
              <p className="text-sm text-muted-foreground mt-1">The app may use file access to import PDFs/images and save/export generated files.</p>
            </div>
            <div>
              <h3 className="font-semibold text-sm text-foreground">4. Account Information</h3>
              <p className="text-sm text-muted-foreground mt-1">If login or account features are enabled, we may process basic account information such as email address and user ID.</p>
            </div>
            <div>
              <h3 className="font-semibold text-sm text-foreground">5. AI Processing</h3>
              <p className="text-sm text-muted-foreground mt-1">When you use AI features such as document summary, handwriting to text, OCR or business card extraction, selected content may be securely sent to our backend server or AI service providers only for processing your request.</p>
            </div>
            <div>
              <h3 className="font-semibold text-sm text-foreground">6. Usage Limits</h3>
              <p className="text-sm text-muted-foreground mt-1">We may store daily usage counts for AI, OCR and PDF processing to prevent abuse.</p>
            </div>
            <div>
              <h3 className="font-semibold text-sm text-foreground">7. Advertising</h3>
              <p className="text-sm text-muted-foreground mt-1">The app shows advertisements using Google AdMob. AdMob and its partners may collect device identifiers, advertising data and approximate location in accordance with the Google Privacy Policy and the Google Play Advertising Policies. ScanMaster has no paid features; advertising is what keeps the app free.</p>
            </div>
            <div>
              <h3 className="font-semibold text-sm text-foreground">8. No Payment Data</h3>
              <p className="text-sm text-muted-foreground mt-1">ScanMaster has no purchases, subscriptions or billing, so we never collect or process card or payment details.</p>
            </div>
            <div>
              <h3 className="font-semibold text-sm text-foreground">9. Permissions Used</h3>
              <p className="text-sm text-muted-foreground mt-1">Camera (document scanning), Microphone (Speech to Text), and file/photo access (importing and exporting documents). Permissions are requested only at the moment the related feature is used.</p>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-primary">How We Use Information</h2>
          <p className="text-sm text-foreground/80 leading-relaxed">We use information to:</p>
          <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
            <li>Provide document scanning and PDF tools</li>
            <li>Process AI features requested by the user</li>
            <li>Save and manage user files locally or through supported storage features</li>
            <li>Enforce usage limits</li>
            <li>Improve app reliability and performance</li>
            <li>Show advertisements where applicable</li>
            <li>Provide support and security</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-primary">Data Sharing</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We do not sell or rent your personal data. Data is shared only with service providers required to operate the app: AI processing providers, authentication providers, advertising networks (Google AdMob) and infrastructure hosts. ScanMaster collects no payment information, because it has no paid features.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-primary">Data Retention and Deletion</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Documents you create stay on your device unless you choose to upload them to your own cloud storage. Scans and images handled by AI features are sent for processing and are not retained by us after the request completes. Account data can be deleted by removing your account or by uninstalling the app.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-primary">Your Rights</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Depending on your country, you may have rights to access, correct, export or delete your personal data, and to object to certain processing. To exercise these rights, contact us using the email below.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-primary">Data Security</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We use reasonable technical measures to protect user data. However, no digital system is completely secure, and users should avoid uploading highly sensitive documents unless they understand the risks.
          </p>
        </section>
        
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-primary">User Responsibility</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Users are responsible for the documents they scan, upload, summarize or share using the app.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-primary">Children's Privacy</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            ScanMaster is not intended for users under the age of 13. If we become aware that we have collected personal data from a child without proper consent, we will take steps to delete it.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-primary">Changes to This Policy</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We may update this Privacy Policy from time to time. Continued use of the app after updates means you accept the revised policy.
          </p>
        </section>

        <section className="space-y-3 border-t border-white/5 pt-6">
          <h2 className="text-lg font-bold text-primary">Contact Us</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            For questions about this Privacy Policy, contact us at:
            <br />
            <a href="mailto:wahid1874254@gmail.com" className="text-primary hover:underline mt-1 block">wahid1874254@gmail.com</a>
          </p>
        </section>
      </div>
    </div>
  )
}
