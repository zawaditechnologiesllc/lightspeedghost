/**
 * SEO Research Engine — Step 1 of 3-step pipeline
 * Fetches community discussions from edtech Reddit communities,
 * then synthesizes insights with Gemini 2.5 Flash (has a real free tier).
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import { logger } from "../lib/logger";

// Model used for ALL SEO-engine Gemini calls (research, topic selection,
// outlining, content + cluster generation). Defaults to Flash because Gemini
// 2.5 Pro has no free tier (free quota = 0). Override with SEO_GEMINI_MODEL to
// use a paid model such as gemini-2.5-pro once billing is enabled.
export const GEMINI_PRO_MODEL = process.env.SEO_GEMINI_MODEL ?? "gemini-2.5-flash";

// Subreddits with strong edtech/academic traffic
const REDDIT_SUBS = [
  "college", "AcademicHelp", "GradSchool", "HomeworkHelp",
  "studytips", "writing", "ChatGPT", "AIToolsTech", "Teachers",
].join("+");

const REDDIT_UA = "LightspeedGhostSEO/1.0 (academic-research-bot; contact@lightspeedghost.com)";

// Reddit's public *.json endpoints now 403 from datacenter IPs — authenticated
// OAuth (application-only) is required to read public posts reliably. Register a
// "script" app at reddit.com/prefs/apps and set REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET.
let redditToken: { token: string; expires: number } | null = null;

async function getRedditToken(): Promise<string | null> {
  const id = process.env.REDDIT_CLIENT_ID;
  const secret = process.env.REDDIT_CLIENT_SECRET;
  if (!id || !secret) return null;
  if (redditToken && redditToken.expires > Date.now() + 60_000) return redditToken.token;
  try {
    const res = await fetch("https://www.reddit.com/api/v1/access_token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": REDDIT_UA,
      },
      body: "grant_type=client_credentials",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      logger.warn({ status: res.status }, "[seo-research] Reddit OAuth token request failed");
      return null;
    }
    const body = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!body.access_token) return null;
    redditToken = { token: body.access_token, expires: Date.now() + (body.expires_in ?? 3600) * 1000 };
    return redditToken.token;
  } catch (err) {
    logger.warn({ err }, "[seo-research] Reddit OAuth token request errored");
    return null;
  }
}

export interface ResearchData {
  painPoints: string[];
  topQuestions: string[];
  highVolumeKeywords: string[];
  competitorMentions: string[];
  suggestedCompetitor: string;
  keyStats: string[];
  summary: string;
  redditInsights: string;
  redditPostCount: number;
}

interface RedditPost {
  title: string;
  selftext: string;
  score: number;
  numComments: number;
  subreddit: string;
}

async function fetchRedditPosts(topic: string): Promise<RedditPost[]> {
  const encoded = encodeURIComponent(topic);
  const query = `?q=${encoded}&sort=top&t=year&limit=15&restrict_sr=false`;

  // Prefer authenticated OAuth (oauth.reddit.com) — the only path that reliably
  // works from a server. Fall back to the public endpoint (best-effort) if no
  // Reddit app credentials are configured.
  const token = await getRedditToken();
  const url = token
    ? `https://oauth.reddit.com/r/${REDDIT_SUBS}/search${query}`
    : `https://www.reddit.com/r/${REDDIT_SUBS}/search.json${query}`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": REDDIT_UA,
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: AbortSignal.timeout(12_000),
    });

    if (!res.ok) {
      logger.warn({ status: res.status, topic, authenticated: Boolean(token) }, "[seo-research] Reddit API returned non-200 — set REDDIT_CLIENT_ID/SECRET if unauthenticated");
      return [];
    }

    const body = (await res.json()) as { data?: { children?: Array<{ data: Record<string, unknown> }> } };
    const children = body?.data?.children ?? [];

    return children
      .map((c) => ({
        title:       String(c.data.title ?? ""),
        selftext:    String(c.data.selftext ?? "").slice(0, 600),
        score:       Number(c.data.score ?? 0),
        numComments: Number(c.data.num_comments ?? 0),
        subreddit:   String(c.data.subreddit ?? ""),
      }))
      .filter((p) => p.score > 1 && p.title.length > 10);
  } catch (err) {
    logger.warn({ err, topic }, "[seo-research] Reddit fetch failed — continuing without it");
    return [];
  }
}

export async function researchTopic(
  topic: string,
  toolFocus: string,
  geminiClient: GoogleGenerativeAI,
): Promise<ResearchData> {
  // ── Step 1: collect Reddit signal ─────────────────────────────────────────
  const posts = await fetchRedditPosts(topic);
  const redditPostCount = posts.length;

  const redditContext =
    posts.length > 0
      ? posts
          .slice(0, 12)
          .map(
            (p, i) =>
              `${i + 1}. [r/${p.subreddit}] "${p.title}" (${p.score} upvotes, ${p.numComments} comments)` +
              (p.selftext ? `\n   "${p.selftext.slice(0, 300)}"` : ""),
          )
          .join("\n\n")
      : "No Reddit data retrieved — use general edtech knowledge instead.";

  const model = geminiClient.getGenerativeModel({ model: GEMINI_PRO_MODEL });

  const prompt = `You are an SEO strategist specialising in edtech and academic writing tools.

RESEARCH BRIEF
Topic: "${topic}"
Platform tool to promote: "${toolFocus}" (LightspeedGhost — lightspeedghost.com)

REAL COMMUNITY DATA (Reddit — college/academic subreddits, top posts from last year)
${redditContext}

Using the community data above AND your own knowledge about this topic:

Return a JSON object with EXACTLY this structure:
{
  "painPoints": [up to 8 specific, concrete pain points students experience],
  "topQuestions": [up to 8 questions students actually search for — phrase as real Google queries],
  "highVolumeKeywords": [up to 10 keywords ordered by estimated search volume, from head to long-tail],
  "competitorMentions": [up to 5 competing tools/services students mention when discussing this topic],
  "suggestedCompetitor": "the SINGLE most Googled competitor for a head-to-head comparison page — choose the one students compare most vs AI writing assistants (e.g. ChatGPT, QuillBot, Grammarly, Chegg, Course Hero, Turnitin, Jasper, Writesonic)",
  "keyStats": [up to 6 real, verifiable statistics about this topic — include source hint in brackets],
  "summary": "2–3 sentence strategic summary: what is the content opportunity and how does ${toolFocus} solve it",
  "redditInsights": "1–2 sentence summary of the specific angles, tone, and vocabulary the Reddit community uses about this topic"
}

Be specific and actionable. Every pain point and question must reflect something a real student would write or search.`;

  let research: ResearchData;

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        // gemini-2.5-pro is a thinking model — reasoning tokens count against this
        // budget, so it needs generous headroom or it returns empty responses.
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
      },
    });

    const text = result.response.text();
    const parsed = JSON.parse(text);

    research = {
      painPoints:           Array.isArray(parsed.painPoints) ? parsed.painPoints : [],
      topQuestions:         Array.isArray(parsed.topQuestions) ? parsed.topQuestions : [],
      highVolumeKeywords:   Array.isArray(parsed.highVolumeKeywords) ? parsed.highVolumeKeywords : [],
      competitorMentions:   Array.isArray(parsed.competitorMentions) ? parsed.competitorMentions : [],
      suggestedCompetitor:  String(parsed.suggestedCompetitor ?? "ChatGPT"),
      keyStats:             Array.isArray(parsed.keyStats) ? parsed.keyStats : [],
      summary:              String(parsed.summary ?? ""),
      redditInsights:       String(parsed.redditInsights ?? ""),
      redditPostCount,
    };
  } catch (err) {
    logger.error({ err, topic }, "[seo-research] Gemini synthesis failed — using minimal fallback");
    research = {
      painPoints:          [`Students struggle with ${topic}`],
      topQuestions:        [`How does ${topic} work?`, `Best ${topic} tools for students?`],
      highVolumeKeywords:  [topic, `${topic} tool`, `${topic} for students`, `best ${topic}`],
      competitorMentions:  ["ChatGPT", "QuillBot", "Grammarly"],
      suggestedCompetitor: "ChatGPT",
      keyStats:            [],
      summary:             `Research for "${topic}" targeting students who need ${toolFocus} support.`,
      redditInsights:      "Community frequently discusses this topic in academic contexts.",
      redditPostCount,
    };
  }

  logger.info({ topic, toolFocus, redditPostCount, painPoints: research.painPoints.length, competitor: research.suggestedCompetitor }, "[seo-research] Research complete");
  return research;
}
