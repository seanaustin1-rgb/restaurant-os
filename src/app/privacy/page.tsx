import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Privacy Policy — OutFront Data",
  description: "How OutFront Data collects, uses, shares, and protects your information.",
};

const SUBPROCESSORS: [string, string][] = [
  ["Plaid", "Bank/transaction data aggregation (read-only)"],
  ["Supabase", "Application database hosting"],
  ["Clerk", "Authentication and identity"],
  ["Vercel", "Application hosting"],
  ["Inngest", "Background job processing"],
  ["Resend", "Transactional email"],
  ["Anthropic", "AI extraction of statements you upload"],
];

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-8 text-xl font-semibold text-gray-900">{children}</h2>;
}

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto my-8 max-w-3xl rounded-xl bg-white px-8 py-10 text-gray-800 shadow-lg">
      <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
        ← Back
      </Link>
      <Image src="/logo.png" alt="OutFront Data" width={1142} height={304} className="mt-6 h-10 w-auto" priority />

      <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-900">Privacy Policy</h1>
      <p className="mt-2 text-sm text-gray-500">
        <strong>OutFront Data</strong>, operated by Makers&apos; House LLC · Effective June 15, 2026 ·
        Contact: seanaustin1@gmail.com
      </p>

      <p className="mt-5 leading-relaxed">
        This Privacy Policy explains what information we collect when you use OutFront Data (the
        &ldquo;Service&rdquo;), how we use and share it, and the choices and rights you have. By using the
        Service, you agree to this Policy.
      </p>

      <H2>1. Who This Applies To</H2>
      <p className="mt-3 leading-relaxed">
        This Policy applies to users of the OutFront Data application — primarily small-business operators and
        their authorized team members (&ldquo;you&rdquo;) who use the Service to view financial insights about
        their business.
      </p>

      <H2>2. Information We Collect</H2>
      <p className="mt-3 leading-relaxed">
        <strong>Information you provide:</strong> account information such as your name, email address, and the
        business details you enter when you sign up or onboard.
      </p>
      <p className="mt-3 leading-relaxed">
        <strong>Financial account data (via Plaid):</strong> when you connect a bank or card account, we use
        Plaid Inc. (&ldquo;Plaid&rdquo;) to securely access <strong>read-only</strong> information about that
        account, including transactions, balances, and account metadata. We do <strong>not</strong> receive or
        store your bank login credentials — those are handled by Plaid — and we do <strong>not</strong> initiate
        payments or move money.
      </p>
      <p className="mt-3 leading-relaxed">
        <strong>Documents you upload:</strong> if you upload bank or card statements, we process them (including
        via an AI service) to extract transaction data for categorization.
      </p>
      <p className="mt-3 leading-relaxed">
        <strong>Usage and technical data:</strong> standard log and device information (e.g., access times, IP
        address, browser type) generated when you use the Service.
      </p>

      <H2>3. How We Use Your Information</H2>
      <ul className="mt-3 list-disc space-y-1 pl-6 leading-relaxed">
        <li>Provide and operate the Service — connect accounts, categorize transactions, and generate cash-flow, cost-structure, and profit-allocation insights;</li>
        <li>Authenticate you and secure your account;</li>
        <li>Communicate with you about the Service;</li>
        <li>Maintain, troubleshoot, and improve the Service; and</li>
        <li>Comply with legal obligations.</li>
      </ul>
      <p className="mt-3 leading-relaxed">We do <strong>not</strong> sell your personal or financial information.</p>

      <H2>4. Plaid</H2>
      <p className="mt-3 leading-relaxed">
        We use Plaid to connect your financial accounts. By using the Service to link an account, you also agree
        to Plaid&apos;s end-user privacy policy, available at{" "}
        <a
          href="https://plaid.com/legal/#end-user-privacy-policy"
          className="text-blue-600 underline hover:text-blue-800"
          target="_blank"
          rel="noopener noreferrer"
        >
          plaid.com/legal
        </a>
        . Plaid&apos;s handling of your information is governed by Plaid&apos;s own privacy policy.
      </p>

      <H2>5. How We Share Information</H2>
      <p className="mt-3 leading-relaxed">
        We share information only as needed to run the Service, with service providers (subprocessors) that
        process data on our behalf under appropriate confidentiality and security obligations:
      </p>
      <table className="mt-3 w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="border border-gray-300 bg-gray-50 px-3 py-2 text-left font-semibold">Provider</th>
            <th className="border border-gray-300 bg-gray-50 px-3 py-2 text-left font-semibold">Purpose</th>
          </tr>
        </thead>
        <tbody>
          {SUBPROCESSORS.map(([name, purpose]) => (
            <tr key={name}>
              <td className="border border-gray-300 px-3 py-2">{name}</td>
              <td className="border border-gray-300 px-3 py-2">{purpose}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 leading-relaxed">
        We may also disclose information if required by law, to protect our rights or users&apos; safety, or in
        connection with a business transfer (e.g., a merger or acquisition). We do <strong>not</strong> sell your
        data or share it for third-party advertising.
      </p>

      <H2>6. Data Retention and Deletion</H2>
      <p className="mt-3 leading-relaxed">
        We retain your information only as long as needed to provide the Service or as required by law. You may
        disconnect a linked account at any time, after which we stop syncing new data and remove the associated
        access tokens. You may request deletion of your account and associated data by contacting us (see §12).
      </p>

      <H2>7. Security</H2>
      <p className="mt-3 leading-relaxed">
        We protect your information using industry-standard safeguards, including encryption in transit (TLS) and
        at rest (financial access tokens are encrypted with AES-256-GCM), role-based access controls,
        multi-factor authentication for privileged access, and tenant isolation. No method of transmission or
        storage is 100% secure, but we work to protect your information.
      </p>

      <H2>8. Your Rights and Choices</H2>
      <p className="mt-3 leading-relaxed">
        Depending on where you live, you may have rights to access, correct, delete, or obtain a copy of your
        personal information, and to withdraw consent (e.g., by disconnecting an account). Residents of certain
        U.S. states (e.g., California) and other jurisdictions (e.g., the EU/UK) may have additional rights. To
        exercise any right, contact us at the address in §12; we will respond as required by applicable law and
        will not discriminate against you for exercising your rights.
      </p>

      <H2>9. Cookies and Tracking</H2>
      <p className="mt-3 leading-relaxed">
        We use cookies and similar technologies only as necessary to authenticate you, keep you signed in, and
        operate the Service. We do not use them for third-party advertising.
      </p>

      <H2>10. Children&apos;s Privacy</H2>
      <p className="mt-3 leading-relaxed">
        The Service is intended for business use by adults and is not directed to children. We do not knowingly
        collect personal information from anyone under 18.
      </p>

      <H2>11. Changes to This Policy</H2>
      <p className="mt-3 leading-relaxed">
        We may update this Policy from time to time. We will post the updated version with a new effective date
        and, where appropriate, notify you.
      </p>

      <H2>12. Contact Us</H2>
      <p className="mt-3 leading-relaxed">
        Questions or requests regarding this Policy or your information:
        <br />
        <strong>Makers&apos; House LLC</strong> — seanaustin1@gmail.com
      </p>

      <p className="mt-10 text-xs text-gray-400">Version 1.0 · June 15, 2026</p>
    </main>
  );
}
