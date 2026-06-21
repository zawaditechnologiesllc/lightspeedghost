/**
 * SEO Research Engine — Step 1 of 3-step pipeline
 * Fetches community discussions from edtech Reddit communities,
 * then synthesizes insights with Gemini 2.5 Flash (has a real free tier).
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as cheerio from "cheerio";
import { logger } from "../lib/logger";

// Model used for ALL SEO-engine Gemini calls (research, topic selection,
// outlining, content + cluster generation). Defaults to Flash because Gemini
// 2.5 Pro has no free tier (free quota = 0). Override with SEO_GEMINI_MODEL to
// use a paid model such as gemini-2.5-pro once billing is enabled.
export const GEMINI_PRO_MODEL = process.env.SEO_GEMINI_MODEL ?? "gemini-2.5-flash";

// Subreddits with strong edtech/academic/AI-writing traffic — restricted-searched
// on old.reddit (a site-wide search runs as a fallback if these return little).
const REDDIT_SUBS = [
  // Students & academia
  "college", "GradSchool", "AskAcademia", "ApplyingToCollege", "gradadmissions",
  "Professors", "students", "APStudents", "PhD", "highschool",
  // Homework & subject help
  "HomeworkHelp", "AcademicHelp", "studytips", "GetStudying",
  "learnmath", "cheatatmathhomework", "chemhelp", "AskPhysics", "statistics",
  "EngineeringStudents", "nursing", "Mcat", "lawschool", "medicalschool",
  // Writing & self-publishing
  "writing", "EssayWriting", "selfpublish", "PubTips", "writers",
  // AI tools
  "ChatGPT", "OpenAI", "artificial", "AIToolsTech",
  // Educators
  "Teachers",
].join("+");

// We scrape Reddit's public HTML directly (no API, no OAuth, no credentials), so
// we present a normal browser User-Agent. old.reddit.com is server-rendered HTML,
// which Cheerio parses cleanly.
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function parseLeadingInt(text: string): number {
  const m = text.replace(/,/g, "").match(/-?\d+/);
  return m ? parseInt(m[0], 10) : 0;
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
  // Scrape Reddit's public search page directly — no API, no OAuth, no keys.
  // old.reddit.com returns server-rendered HTML; we parse it with Cheerio. If a
  // page can't be fetched (Reddit throttling), we return [] and the synthesis
  // step falls back to the model's own knowledge, so the pipeline still completes.
  const encoded = encodeURIComponent(topic);
  // Try the academic-subreddit restricted search first, then a site-wide search.
  const urls = [
    `https://old.reddit.com/r/${REDDIT_SUBS}/search?q=${encoded}&restrict_sr=on&sort=top&t=year`,
    `https://old.reddit.com/search?q=${encoded}&sort=top&t=year`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": BROWSER_UA,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
        signal: AbortSignal.timeout(12_000),
      });

      if (!res.ok) {
        logger.warn({ status: res.status, topic, url }, "[seo-research] Reddit scrape returned non-200 — trying next");
        continue;
      }

      const html = await res.text();
      const $ = cheerio.load(html);
      const posts: RedditPost[] = [];

      $(".search-result-link").each((_i, el) => {
        const $el = $(el);
        const title = $el.find("a.search-title").first().text().trim();
        if (title.length < 10) return;
        posts.push({
          title,
          selftext:    $el.find(".search-result-body").first().text().trim().slice(0, 600),
          score:       parseLeadingInt($el.find(".search-score").first().text()),
          numComments: parseLeadingInt($el.find(".search-comments").first().text()),
          subreddit:   $el.find(".search-subreddit-link").first().text().replace(/^\/?r\//i, "").trim(),
        });
      });

      const filtered = posts.filter((p) => p.score > 1 && p.title.length > 10).slice(0, 15);
      if (filtered.length > 0) {
        logger.info({ topic, found: filtered.length }, "[seo-research] Reddit scrape succeeded");
        return filtered;
      }
    } catch (err) {
      logger.warn({ err, topic, url }, "[seo-research] Reddit scrape failed — trying next");
    }
  }

  return [];
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
