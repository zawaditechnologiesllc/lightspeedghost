import { useEffect } from "react";
import { useLocation } from "wouter";

// ─────────────────────────────────────────────────────────────────────────────
// Per-route <head> metadata for the public, indexable marketing routes.
//
// This app is a client-rendered SPA on every route except `/seo/*` (which the
// backend server-renders). Cloudflare Pages serves all SPA routes from the same
// index.html, so without this component every route would inherit the homepage's
// <title> and — previously — a static `canonical` pointing at the homepage,
// telling Google that /about, /pricing, /africa, … are duplicates of "/".
//
// The fix is the standard, policy-compliant one: a SELF-REFERENTIAL canonical
// plus a unique, honest <title> and description per route. We do NOT cloak —
// users and crawlers get the same JS-rendered result. Google processes
// canonicals inserted via JS; per-route server rendering would be the gold
// standard, but this closes the duplicate-canonical bug for all crawlers.
//
// Auth-gated tool routes (/write, /humanizer, …) are Disallowed in robots.txt,
// so they are intentionally omitted (no canonical needed → each URL is
// self-canonical by default). /blog/:slug manages its own head in BlogPost.tsx.
// ─────────────────────────────────────────────────────────────────────────────

const ORIGIN = "https://lightspeedghost.com";

const ROUTE_META: Record<string, { title: string; description: string }> = {
  "/": {
    title: "Light Speed Ghost — AI Academic Writing for Students",
    description:
      "AI academic platform for students: write papers with real citations from 35+ databases, refine AI-assisted writing to read naturally, check plagiarism, and solve STEM step by step. Free plan available — Pro $29.99/mo.",
  },
  "/about": {
    title: "About Light Speed Ghost — Ethical AI Academic Writing",
    description:
      "Learn about Light Speed Ghost, the AI academic writing platform that helps students write, cite, and check their work with academic integrity.",
  },
  "/contact": {
    title: "Contact Light Speed Ghost",
    description:
      "Get in touch with the Light Speed Ghost team for support, sales, and partnership enquiries about our AI academic writing platform.",
  },
  "/careers": {
    title: "Careers at Light Speed Ghost",
    description:
      "Join Light Speed Ghost. Explore open roles building the AI academic writing platform trusted by students worldwide.",
  },
  "/blog": {
    title: "Light Speed Ghost Blog — AI Writing & Study Tips",
    description:
      "Guides on academic writing, citations, study skills, and using AI ethically — from the Light Speed Ghost team.",
  },
  "/africa": {
    title: "Light Speed Ghost for African Students",
    description:
      "AI academic writing built for African students: real citations, affordable plans, and local payment options.",
  },
  "/enterprise": {
    title: "Light Speed Ghost for Institutions & Enterprise",
    description:
      "Bring Light Speed Ghost to your institution: bulk plans, admin controls, and academic-integrity-first AI writing support.",
  },
  "/privacy": {
    title: "Privacy Policy — Light Speed Ghost",
    description: "How Light Speed Ghost collects, uses, and protects your data. Read our full privacy policy.",
  },
  "/terms": {
    title: "Terms of Service — Light Speed Ghost",
    description: "The terms governing your use of Light Speed Ghost's AI academic writing platform.",
  },
  "/refunds": {
    title: "Refund Policy — Light Speed Ghost",
    description: "Our refund policy for Light Speed Ghost subscriptions and pay-as-you-go purchases.",
  },
  "/cookies": {
    title: "Cookie Policy — Light Speed Ghost",
    description: "How Light Speed Ghost uses cookies and similar technologies.",
  },
  "/academic-use": {
    title: "Academic Use Policy — Light Speed Ghost",
    description:
      "How to use Light Speed Ghost ethically and within your institution's academic-integrity rules.",
  },
};

function upsertMeta(attr: "name" | "property", key: string, content: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

/** Sets a self-referential canonical + unique title/description for public
 *  marketing routes. Renders nothing. */
export function RouteMeta(): null {
  const [path] = useLocation();

  useEffect(() => {
    const meta = ROUTE_META[path];
    // Leave the head untouched for routes we don't manage here (BlogPost sets its
    // own; auth-gated tools are noindex). No canonical => self-canonical default.
    if (!meta) return;

    document.title = meta.title;

    const url = ORIGIN + (path === "/" ? "/" : path);
    let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement("link");
      link.setAttribute("rel", "canonical");
      document.head.appendChild(link);
    }
    link.setAttribute("href", url);

    upsertMeta("name", "description", meta.description);
    upsertMeta("property", "og:title", meta.title);
    upsertMeta("property", "og:description", meta.description);
    upsertMeta("property", "og:url", url);
  }, [path]);

  return null;
}
