import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/Logo";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-[#04080f] text-white antialiased">
      <header className="border-b border-white/5 px-6 h-16 flex items-center justify-between max-w-7xl mx-auto">
        <Link href="/"><Logo size={28} textSize="text-base" className="cursor-pointer" /></Link>
        <Link href="/"><span className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white transition-colors cursor-pointer"><ArrowLeft size={14} /> Back to home</span></Link>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-16">
        <p className="text-blue-400 text-xs font-semibold uppercase tracking-widest mb-3">Legal</p>
        <h1 className="text-4xl font-bold mb-3">Privacy Policy</h1>
        <p className="text-white/40 text-sm mb-12">Last updated: January 2025</p>

        <div className="prose prose-invert prose-sm max-w-none space-y-10 text-white/70 leading-relaxed">

          <section>
            <h2 className="text-white text-xl font-semibold mb-4">1. Who We Are</h2>
            <p>Light Speed Ghost ("we", "us", "our") is an AI-powered academic writing platform operated by Light Speed Ghost, located at 500 Oracle Pkwy, Redwood City, CA 94065. You can reach us at <a href="mailto:info@lightspeedghost.com" className="text-blue-400 hover:text-blue-300">info@lightspeedghost.com</a>.</p>
          </section>

          <section>
            <h2 className="text-white text-xl font-semibold mb-4">2. Information We Collect</h2>
            <p className="mb-3">We collect information you provide directly to us, including:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong className="text-white">Account information:</strong> Email address and password when you register.</li>
              <li><strong className="text-white">Content you submit:</strong> Assignment briefs, uploaded documents, generated papers, and STEM problems. This content is used solely to provide the service to you.</li>
              <li><strong className="text-white">Usage data:</strong> Which tools you use, generation counts, and session metadata — used to improve the platform.</li>
              <li><strong className="text-white">Payment information:</strong> Processed securely by Stripe. We do not store your card details.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white text-xl font-semibold mb-4">3. How We Use Your Information</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>To provide and operate the platform and its features</li>
              <li>To authenticate your account and secure your session</li>
              <li>To process payments and manage your subscription</li>
              <li>To send transactional emails (account confirmation, password reset)</li>
              <li>To improve and debug our AI models and platform performance</li>
              <li>To respond to your support requests</li>
            </ul>
            <p className="mt-3">We do not use your submitted documents to train our AI models. We do not sell your data to third parties.</p>
          </section>

          <section>
            <h2 className="text-white text-xl font-semibold mb-4">4. Data Storage and Security</h2>
            <p>Your data is stored on Supabase (PostgreSQL), hosted on AWS infrastructure with encryption at rest and in transit. We use industry-standard security practices including HTTPS, bcrypt password hashing, and JWT-based session authentication.</p>
          </section>

          <section>
            <h2 className="text-white text-xl font-semibold mb-4">5. Data Retention</h2>
            <p>Your account data is retained as long as your account is active. Generated documents are retained for the duration of your plan (90 days for Pro, 7 days for Starter). You can delete your account and all associated data at any time by contacting us.</p>
          </section>

          <section>
            <h2 className="text-white text-xl font-semibold mb-4">6. Third-Party Services</h2>
            <p className="mb-3">We use the following third-party services:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong className="text-white">Anthropic / OpenAI:</strong> AI generation services. Your content is processed by their APIs under their data processing agreements.</li>
              <li><strong className="text-white">Semantic Scholar:</strong> Academic citation database. Queries are made on your behalf.</li>
              <li><strong className="text-white">Stripe:</strong> Payment processing. Subject to Stripe's privacy policy.</li>
              <li><strong className="text-white">Tidio:</strong> Live chat support widget.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white text-xl font-semibold mb-4">7. Your Rights</h2>
            <p>Depending on your location, you may have the right to access, correct, delete, or export your personal data. To exercise these rights, contact us at <a href="mailto:info@lightspeedghost.com" className="text-blue-400 hover:text-blue-300">info@lightspeedghost.com</a>.</p>
          </section>

          <section>
            <h2 className="text-white text-xl font-semibold mb-4">8. Cookies</h2>
            <p>We use essential cookies for authentication and session management. See our <Link href="/cookies"><span className="text-blue-400 hover:text-blue-300 cursor-pointer">Cookie Policy</span></Link> for details.</p>
          </section>

          <section>
            <h2 className="text-white text-xl font-semibold mb-4">9. Changes to This Policy</h2>
            <p>We may update this policy from time to time. We'll notify you via email if we make material changes. Continued use of the platform after changes constitutes acceptance.</p>
          </section>

          <section>
            <h2 className="text-white text-xl font-semibold mb-4">10. Contact</h2>
            <p>Questions about this policy? Email us at <a href="mailto:info@lightspeedghost.com" className="text-blue-400 hover:text-blue-300">info@lightspeedghost.com</a>.</p>
          </section>
        </div>
      </main>

      <footer className="border-t border-white/5 py-8 px-6 text-center">
        <p className="text-white/25 text-xs">© {new Date().getFullYear()} Light Speed Ghost. All rights reserved.</p>
      </footer>
    </div>
  );
}
