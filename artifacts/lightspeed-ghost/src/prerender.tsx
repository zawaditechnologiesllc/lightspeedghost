import { renderToString } from "react-dom/server";
import { Router } from "wouter";
import Landing from "@/pages/Landing";

// Build-time pre-render of the landing route. It renders the real <Landing/>
// with a static "/" location and the default (logged-out) auth context — which
// is exactly what a fresh visitor sees on first paint. The client then renders
// the full app over this with createRoot (NOT hydrate), so there is no
// hydration matching to get wrong: the pre-rendered markup is purely a fast
// first-paint placeholder that React replaces. If this ever threw, the build
// would fail and production simply wouldn't update — it can't ship a broken page.
export function render(): string {
  return renderToString(
    <Router ssrPath="/">
      <Landing />
    </Router>,
  );
}
