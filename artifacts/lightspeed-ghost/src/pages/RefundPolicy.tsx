import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/Logo";

export default function RefundPolicy() {
  return (
    <div className="min-h-screen bg-[#04080f] text-white antialiased">
      <header className="border-b border-white/5 px-6 h-16 flex items-center justify-between max-w-7xl mx-auto">
        <Link href="/"><Logo size={28} textSize="text-base" className="cursor-pointer" /></Link>
        <Link href="/"><span className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white transition-colors cursor-pointer"><ArrowLeft size={14} /> Back to home</span></Link>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-16">
        <p className="text-blue-400 text-xs font-semibold uppercase tracking-widest mb-3">Legal</p>
        <h1 className="text-4xl font-bold mb-3">Refund Policy</h1>
        <p className="text-white/40 text-sm mb-12">Last updated: April 2025 · Effective immediately</p>

        <div className="space-y-10 text-white/70 leading-relaxed">

          <section>
            <h2 className="text-white text-xl font-semibold mb-4">1. Overview</h2>
            <p>
              Light Speed Ghost ("the Platform", "we", "us") provides digital AI-assisted academic writing services. Because our services are delivered instantly and electronically upon purchase, all sales are generally final. This policy describes the specific circumstances under which we do issue refunds, and how to request one.
            </p>
            <p className="mt-3">
              By making a purchase on the Platform — whether a subscription, a Pay-As-You-Go (PAYG) purchase, or a credit top-up — you acknowledge and agree to this Refund Policy.
            </p>
          </section>

          <section>
            <h2 className="text-white text-xl font-semibold mb-4">2. Subscriptions</h2>

            <h3 className="text-white font-semibold mb-2 mt-5">2.1 Monthly Plans (Pro)</h3>
            <p>
              Monthly subscription fees are charged at the start of each billing cycle and cover access to the Platform for that period. We do not offer prorated refunds for unused days within an active billing period.
            </p>
            <p className="mt-3">
              If you cancel your subscription, you will retain access to your paid features until the end of the current billing period. Your subscription will not renew after that date and no further charges will be made.
            </p>

            <h3 className="text-white font-semibold mb-2 mt-5">2.2 Annual Plans (Pro Annual, Campus Annual)</h3>
            <p>
              Annual plans may be eligible for a prorated refund if a refund request is submitted within <strong className="text-white">14 days</strong> of the initial purchase date, provided that no more than one (1) document generation has been completed using the subscription. After 14 days, or after meaningful use of the service, annual plans are non-refundable.
            </p>

            <h3 className="text-white font-semibold mb-2 mt-5">2.3 Duplicate or Accidental Charges</h3>
            <p>
              If you were charged twice for the same subscription period due to a billing error, we will refund the duplicate charge in full within 5 business days of confirmation.
            </p>
          </section>

          <section>
            <h2 className="text-white text-xl font-semibold mb-4">3. Pay-As-You-Go (PAYG) Purchases</h2>
            <p>
              PAYG purchases are single-use purchases for specific tools (paper generation, humanizer, STEM solver, etc.). Because the service is delivered immediately upon payment, PAYG purchases are <strong className="text-white">non-refundable</strong> once processing has begun.
            </p>
            <p className="mt-3">
              Exceptions apply in the following circumstances:
            </p>
            <ul className="list-disc pl-5 space-y-2 mt-3">
              <li><strong className="text-white/90">Technical failure:</strong> If the service fails to deliver output due to a confirmed platform error (not an error caused by your input), we will either re-run the service at no additional charge or issue a full refund of the purchase amount.</li>
              <li><strong className="text-white/90">Accidental duplicate purchase:</strong> If you purchased the same tool for the same document twice within 10 minutes and can demonstrate that no output from the second purchase was used, we will refund the second charge.</li>
              <li><strong className="text-white/90">Charge without output:</strong> If your payment was processed but no output was generated and no credits were applied to your account, you are entitled to a full refund.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white text-xl font-semibold mb-4">4. Credit Top-Ups</h2>
            <p>
              Credits purchased as top-ups are non-refundable once added to your account. Credits do not expire and carry over across billing periods, so there is no risk of losing what you have paid for. If credits were added to your account in error (e.g. due to a duplicate charge), we will investigate and reverse the error.
            </p>
          </section>

          <section>
            <h2 className="text-white text-xl font-semibold mb-4">5. Starter Plan</h2>
            <p>
              The Starter plan is a paid monthly plan at $1.50/month and is subject to the same refund terms as other paid plans in Section 2. If you upgrade from Starter to Pro or Campus, the higher-tier plan terms in Section 2 apply from the date of upgrade.
            </p>
          </section>

          <section>
            <h2 className="text-white text-xl font-semibold mb-4">6. Chargebacks and Disputes</h2>
            <p>
              If you believe a charge is incorrect, please contact us directly before initiating a chargeback with your bank or card issuer. We respond to all refund requests within 2 business days and resolve eligible cases within 5 business days — significantly faster than the typical chargeback process.
            </p>
            <p className="mt-3">
              Initiating a chargeback without first contacting us may result in immediate suspension of your account pending investigation. We reserve the right to contest chargebacks that do not meet the refund criteria in this policy.
            </p>
          </section>

          <section>
            <h2 className="text-white text-xl font-semibold mb-4">7. How to Request a Refund</h2>
            <p>To submit a refund request, email us at <a href="mailto:billing@lightspeedghost.com" className="text-blue-400 hover:text-blue-300">billing@lightspeedghost.com</a> with the following information:</p>
            <ul className="list-disc pl-5 space-y-2 mt-3">
              <li>The email address associated with your account</li>
              <li>The date and approximate amount of the charge</li>
              <li>The reason for your refund request</li>
              <li>Any relevant screenshots or context (optional but helpful)</li>
            </ul>
            <p className="mt-4">
              We will acknowledge your request within <strong className="text-white">2 business days</strong> and resolve eligible cases within <strong className="text-white">5 business days</strong>. Approved refunds are returned to your original payment method and typically appear within 5–10 business days depending on your bank.
            </p>
          </section>

          <section>
            <h2 className="text-white text-xl font-semibold mb-4">8. Regional Consumer Rights</h2>
            <p>
              Nothing in this policy limits or overrides any rights you may have under applicable consumer protection law in your jurisdiction. If local law grants you additional refund rights that exceed what is described here, those rights apply to you.
            </p>
            <p className="mt-3">
              Customers in the European Economic Area (EEA) and United Kingdom may have a statutory right to cancel digital service purchases within 14 days of purchase ("cooling-off period"), unless the digital content delivery has begun with your explicit consent and acknowledgment that this right is waived upon delivery. By completing a PAYG purchase or activating a subscription, you acknowledge this waiver.
            </p>
          </section>

          <section>
            <h2 className="text-white text-xl font-semibold mb-4">9. Changes to This Policy</h2>
            <p>
              We may update this Refund Policy from time to time. When we do, we will update the "Last updated" date at the top of this page. Continued use of the Platform after changes are posted constitutes your acceptance of the revised policy. For significant changes, we will notify active subscribers via email.
            </p>
          </section>

          <section>
            <h2 className="text-white text-xl font-semibold mb-4">10. Contact</h2>
            <p>Questions about this policy or a specific charge should be directed to:</p>
            <div className="mt-4 p-5 rounded-xl bg-white/[0.03] border border-white/8">
              <p className="text-white font-medium">Light Speed Ghost — Billing Support</p>
              <p className="mt-1"><a href="mailto:billing@lightspeedghost.com" className="text-blue-400 hover:text-blue-300">billing@lightspeedghost.com</a></p>
              <p className="mt-1 text-white/40 text-sm">500 Oracle Pkwy, Redwood City, CA 94065</p>
              <p className="mt-1 text-white/40 text-sm">Response time: within 2 business days</p>
            </div>
            <p className="mt-5">
              For general support enquiries, visit our <Link href="/contact"><span className="text-blue-400 hover:text-blue-300 cursor-pointer">Contact page</span></Link>. For details on how we handle your data in connection with payments, see our <Link href="/privacy"><span className="text-blue-400 hover:text-blue-300 cursor-pointer">Privacy Policy</span></Link>.
            </p>
          </section>

        </div>
      </main>

      <footer className="border-t border-white/5 py-8 px-6 text-center mt-16">
        <p className="text-white/25 text-xs">© {new Date().getFullYear()} Light Speed Ghost. All rights reserved. · <a href="mailto:billing@lightspeedghost.com" className="hover:text-white/50">billing@lightspeedghost.com</a></p>
      </footer>
    </div>
  );
}
