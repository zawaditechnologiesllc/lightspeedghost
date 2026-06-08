/**
 * SEO Research Engine — Step 1 of 3-step pipeline
 * Fetches community discussions from edtech Reddit communities,
 * then synthesizes insights with Gemini 2.5 Pro.
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import { logger } from "../lib/logger";

export const GEMINI_FLASH_MODEL = "gemini-2.5-flash";

// Subreddits with strong edtech/academic traffic
const REDDIT_SUBS = [
  "college", "AcademicHelp", "GradSchool", "HomeworkHelp",
  "studytips", "writing", "ChatGPT", "AIToolsTech", "Teachers",
].join("+");

export interface ResearchData {
  painPoints: string[];
  topQuestions: string[];
  highVolumeKeywords: string[];
  competitorMentions: string[];
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
  const url =
    `https://www.reddit.com/r/${REDDIT_SUBS}/search.json` +
    `?q=${encoded}&sort=top&t=year&limit=15&restrict_sr=false`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "LightspeedGhostSEO/1.0 (academic-research-bot; contact@lightspeedghost.com)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(12_000),
    });

    if (!res.ok) {
      logger.warn({ status: res.status, topic }, "[seo-research] Reddit API returned non-200");
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

  const model = geminiClient.getGenerativeModel({ model: GEMINI_FLASH_MODEL });

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
        maxOutputTokens: 2000,
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
      keyStats:             Array.isArray(parsed.keyStats) ? parsed.keyStats : [],
      summary:              String(parsed.summary ?? ""),
      redditInsights:       String(parsed.redditInsights ?? ""),
      redditPostCount,
    };
  } catch (err) {
    logger.error({ err, topic }, "[seo-research] Gemini synthesis failed — using minimal fallback");
    research = {
      painPoints:         [`Students struggle with ${topic}`],
      topQuestions:       [`How does ${topic} work?`, `Best ${topic} tools for students?`],
      highVolumeKeywords: [topic, `${topic} tool`, `${topic} for students`, `best ${topic}`],
      competitorMentions: ["ChatGPT", "QuillBot", "Grammarly"],
      keyStats:           [],
      summary:            `Research for "${topic}" targeting students who need ${toolFocus} support.`,
      redditInsights:     "Community frequently discusses this topic in academic contexts.",
      redditPostCount,
    };
  }

  logger.info({ topic, toolFocus, redditPostCount, painPoints: research.painPoints.length }, "[seo-research] Research complete");
  return research;
}
