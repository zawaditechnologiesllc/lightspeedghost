import { useEffect } from "react";
import { useParams } from "wouter";

export default function SeoPage() {
  const { slug } = useParams<{ slug: string }>();

  useEffect(() => {
    if (slug) {
      // Navigate to the server-rendered SEO page — full page load required
      // so that Google and other crawlers see the complete server-rendered HTML
      window.location.href = `/seo/${slug}`;
    }
  }, [slug]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p>Loading...</p>
    </div>
  );
}
