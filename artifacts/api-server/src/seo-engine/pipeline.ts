/**
 * SEO Article Pipeline — Coordinates 3-step article generation
 * Step 1: Research (Reddit + Gemini synthesis)
 * Step 2: Outline (5-page cluster structure)
 * Step 3: Write (generate each page in sequence)
 *
 * Enforces 5-page / 24-hour limit (= 1 article cluster per day).
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";
import { researchTopic } from "./researcher";
import { buildOutline } from "./outliner";
import { generateClusterPage, saveClusterPage } from "./five-page-cluster";

const PIPELINE_DAILY_PAGE_LIMIT = 5;

const geminiClient = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

export type PipelineStatus =
  | "pending"
  | "researching"
  | "outlining"
  | "writing_1"
  | "writing_2"
  | "writing_3"
  | "writing_4"
  | "writing_5"
  | "complete"
  | "failed";

export interface ArticleCluster {
  id:              string;
  topic:           string;
  topicSlug:       string;
  toolFocus:       string;
  competitor:      string;
  audienceSegment: string;
  status:          PipelineStatus;
  currentStage:    string;
  pagesCompleted:  number;
  researchData:    Record<string, unknown> | null;
  outlineData:     Record<string, unknown> | null;
  errorMessage:    string | null;
  startedAt:       string | null;
  completedAt:     string | null;
  createdAt:       string;
  updatedAt:       string;
  pages?:          Array<{
    slug: string; pageType: string; pageNumber: number;
    status: string; published: boolean; wordCount: number | null;
  }>;
}

// ── Daily limit check ─────────────────────────────────────────────────────────

export async function getDailyPipelineUsage(): Promise<{
  used:      number;
  limit:     number;
  canStart:  boolean;
  resetAt:   string;
}> {
  const { rows } = await pool.query(`
    SELECT COUNT(*) AS cnt
    FROM seo_pages
    WHERE cluster_id IS NOT NULL
      AND created_at > NOW() - INTERVAL '24 hours'
  `);
  const used = parseInt(rows[0]?.cnt ?? "0");
  const resetAt = new Date(Date.now() + (24 * 60 * 60 * 1000 - (Date.now() % (24 * 60 * 60 * 1000)))).toISOString();
  return { used, limit: PIPELINE_DAILY_PAGE_LIMIT, canStart: used < PIPELINE_DAILY_PAGE_LIMIT, resetAt };
}

// ── Start a new pipeline ──────────────────────────────────────────────────────

export async function startPipeline(opts: {
  topic:            string;
  toolFocus:        string;
  competitor?:      string;
  audienceSegment?: string;
  autoPublish?:     boolean;
}): Promise<{ clusterId: string; error?: string }> {
  if (!geminiClient) {
    return { clusterId: "", error: "GEMINI_API_KEY not configured" };
  }

  const { used, limit } = await getDailyPipelineUsage();
  if (used >= limit) {
    return { clusterId: "", error: `Daily limit reached (${used}/${limit} pages in last 24 hours). Try again later.` };
  }

  const topicSlug = opts.topic
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);

  // Create cluster record
  const { rows } = await pool.query(
    `INSERT INTO seo_article_clusters (
      topic, topic_slug, tool_focus, competitor, audience_segment,
      status, current_stage, pages_completed
    ) VALUES ($1,$2,$3,$4,$5,'pending','research',0)
    RETURNING id`,
    [
      opts.topic,
      topicSlug,
      opts.toolFocus,
      opts.competitor ?? "ChatGPT",
      opts.audienceSegment ?? "students",
    ],
  );

  const clusterId = rows[0].id as string;
  logger.info({ clusterId, topic: opts.topic, toolFocus: opts.toolFocus }, "[seo-pipeline] Cluster created");

  // Fire and forget — run pipeline asynchronously
  setImmediate(() => {
    runPipeline(clusterId, {
      autoPublish: opts.autoPublish ?? false,
    }).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ err, clusterId }, "[seo-pipeline] Unhandled pipeline error");
      pool.query(
        `UPDATE seo_article_clusters SET status = 'failed', error_message = $1, updated_at = now() WHERE id = $2`,
        [msg, clusterId],
      ).catch(() => {});
    });
  });

  return { clusterId };
}

// ── Update cluster status helper ──────────────────────────────────────────────

async function updateCluster(
  id: string,
  fields: Partial<{
    status:           PipelineStatus;
    currentStage:     string;
    pagesCompleted:   number;
    researchData:     unknown;
    outlineData:      unknown;
    errorMessage:     string;
    startedAt:        string;
    completedAt:      string;
  }>,
): Promise<void> {
  const sets: string[] = ["updated_at = now()"];
  const params: unknown[] = [];
  let p = 1;

  if (fields.status          !== undefined) { sets.push(`status = $${p++}`);           params.push(fields.status); }
  if (fields.currentStage    !== undefined) { sets.push(`current_stage = $${p++}`);    params.push(fields.currentStage); }
  if (fields.pagesCompleted  !== undefined) { sets.push(`pages_completed = $${p++}`);  params.push(fields.pagesCompleted); }
  if (fields.researchData    !== undefined) { sets.push(`research_data = $${p++}::jsonb`);  params.push(JSON.stringify(fields.researchData)); }
  if (fields.outlineData     !== undefined) { sets.push(`outline_data = $${p++}::jsonb`);   params.push(JSON.stringify(fields.outlineData)); }
  if (fields.errorMessage    !== undefined) { sets.push(`error_message = $${p++}`);    params.push(fields.errorMessage); }
  if (fields.startedAt       !== undefined) { sets.push(`started_at = $${p++}`);       params.push(fields.startedAt); }
  if (fields.completedAt     !== undefined) { sets.push(`completed_at = $${p++}`);     params.push(fields.completedAt); }

  params.push(id);
  await pool.query(
    `UPDATE seo_article_clusters SET ${sets.join(", ")} WHERE id = $${p}`,
    params,
  );
}

// ── Run the full 3-step pipeline ──────────────────────────────────────────────

export async function runPipeline(
  clusterId: string,
  opts: { autoPublish?: boolean } = {},
): Promise<void> {
  if (!geminiClient) throw new Error("GEMINI_API_KEY not configured");

  // Load cluster
  const { rows: clusterRows } = await pool.query(
    `SELECT * FROM seo_article_clusters WHERE id = $1`,
    [clusterId],
  );
  if (!clusterRows[0]) throw new Error(`Cluster ${clusterId} not found`);

  const cluster = clusterRows[0] as {
    topic: string; tool_focus: string; competitor: string;
    audience_segment: string; status: string;
  };

  await updateCluster(clusterId, {
    status:      "researching",
    currentStage: "research",
    startedAt:   new Date().toISOString(),
  });

  // ── STEP 1: Research ───────────────────────────────────────────────────────
  logger.info({ clusterId, step: 1 }, "[seo-pipeline] Starting research");
  let research;
  try {
    research = await researchTopic(cluster.topic, cluster.tool_focus, geminiClient);
    await updateCluster(clusterId, {
      researchData: research,
      status:       "outlining",
      currentStage: "outline",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await updateCluster(clusterId, { status: "failed", errorMessage: `Research failed: ${msg}` });
    throw err;
  }

  // ── STEP 2: Outline ────────────────────────────────────────────────────────
  logger.info({ clusterId, step: 2 }, "[seo-pipeline] Building outline");
  let outline;
  try {
    outline = await buildOutline(
      cluster.topic,
      research,
      cluster.tool_focus,
      cluster.competitor,
      geminiClient,
    );
    await updateCluster(clusterId, {
      outlineData:  outline,
      status:       "writing_1",
      currentStage: "write_1",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await updateCluster(clusterId, { status: "failed", errorMessage: `Outline failed: ${msg}` });
    throw err;
  }

  // ── STEP 3: Write all 5 pages sequentially ────────────────────────────────
  const stageMap: Record<number, PipelineStatus> = {
    1: "writing_1", 2: "writing_2", 3: "writing_3", 4: "writing_4", 5: "writing_5",
  };

  for (const pageOutline of outline.pages) {
    const pageNum = pageOutline.pageNumber;
    logger.info({ clusterId, pageNum, pageType: pageOutline.pageType, slug: pageOutline.slug }, "[seo-pipeline] Writing page");

    try {
      await updateCluster(clusterId, {
        status:       stageMap[pageNum] ?? "writing_1",
        currentStage: `write_${pageNum}`,
      });

      const page = await generateClusterPage(pageOutline, outline, research, geminiClient);
      await saveClusterPage(page, pageOutline, clusterId, outline.toolFocus, opts.autoPublish ?? false);

      await updateCluster(clusterId, { pagesCompleted: pageNum });

      logger.info({ clusterId, pageNum, slug: page.slug, wordCount: page.wordCount, costUsd: page.costUsd }, "[seo-pipeline] Page written");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ err, clusterId, pageNum }, "[seo-pipeline] Page generation failed");
      await updateCluster(clusterId, {
        status:       "failed",
        errorMessage: `Page ${pageNum} (${pageOutline.pageType}) failed: ${msg}`,
      });
      throw err;
    }

    // Avoid rate-limiting between pages
    await new Promise((r) => setTimeout(r, 1500));
  }

  await updateCluster(clusterId, {
    status:       "complete",
    currentStage: "complete",
    completedAt:  new Date().toISOString(),
  });

  logger.info({ clusterId, topic: cluster.topic, pages: outline.pages.length }, "[seo-pipeline] Pipeline complete");
}

// ── Retry a failed pipeline from where it stopped ────────────────────────────

export async function resumePipeline(clusterId: string, opts: { autoPublish?: boolean } = {}): Promise<void> {
  const { rows } = await pool.query(
    `SELECT status FROM seo_article_clusters WHERE id = $1`,
    [clusterId],
  );
  if (!rows[0]) throw new Error("Cluster not found");

  const status = rows[0].status as string;
  if (status === "complete") throw new Error("Pipeline already complete");
  if (!["failed", "pending"].includes(status)) throw new Error(`Pipeline is currently running (status: ${status})`);

  // Reset to run from scratch (research is cheap and ensures fresh data)
  await updateCluster(clusterId, {
    status:       "pending",
    currentStage: "research",
    pagesCompleted: 0,
    errorMessage:  undefined,
  });

  // Remove any partially generated pages for this cluster
  await pool.query(`DELETE FROM seo_pages WHERE cluster_id = $1`, [clusterId]);

  setImmediate(() => {
    runPipeline(clusterId, opts).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      pool.query(
        `UPDATE seo_article_clusters SET status = 'failed', error_message = $1, updated_at = now() WHERE id = $2`,
        [msg, clusterId],
      ).catch(() => {});
    });
  });
}

// ── Query helpers ─────────────────────────────────────────────────────────────

export async function getCluster(clusterId: string): Promise<ArticleCluster | null> {
  const { rows } = await pool.query(
    `SELECT
      c.*,
      json_agg(
        json_build_object(
          'slug', p.slug,
          'pageType', p.cluster_page_type,
          'pageNumber', p.cluster_page_number,
          'status', p.status,
          'published', p.published,
          'wordCount', p.word_count
        ) ORDER BY p.cluster_page_number
      ) FILTER (WHERE p.slug IS NOT NULL) AS pages
    FROM seo_article_clusters c
    LEFT JOIN seo_pages p ON p.cluster_id = c.id
    WHERE c.id = $1
    GROUP BY c.id`,
    [clusterId],
  );
  if (!rows[0]) return null;
  return mapClusterRow(rows[0]);
}

export async function listClusters(limit = 20): Promise<ArticleCluster[]> {
  const { rows } = await pool.query(
    `SELECT
      c.*,
      json_agg(
        json_build_object(
          'slug', p.slug,
          'pageType', p.cluster_page_type,
          'pageNumber', p.cluster_page_number,
          'status', p.status,
          'published', p.published,
          'wordCount', p.word_count
        ) ORDER BY p.cluster_page_number
      ) FILTER (WHERE p.slug IS NOT NULL) AS pages
    FROM seo_article_clusters c
    LEFT JOIN seo_pages p ON p.cluster_id = c.id
    GROUP BY c.id
    ORDER BY c.created_at DESC
    LIMIT $1`,
    [limit],
  );
  return rows.map(mapClusterRow);
}

function mapClusterRow(r: Record<string, unknown>): ArticleCluster {
  return {
    id:              String(r.id),
    topic:           String(r.topic),
    topicSlug:       String(r.topic_slug),
    toolFocus:       String(r.tool_focus),
    competitor:      String(r.competitor ?? ""),
    audienceSegment: String(r.audience_segment ?? "students"),
    status:          String(r.status) as PipelineStatus,
    currentStage:    String(r.current_stage ?? ""),
    pagesCompleted:  Number(r.pages_completed ?? 0),
    researchData:    r.research_data as Record<string, unknown> | null,
    outlineData:     r.outline_data as Record<string, unknown> | null,
    errorMessage:    r.error_message ? String(r.error_message) : null,
    startedAt:       r.started_at ? String(r.started_at) : null,
    completedAt:     r.completed_at ? String(r.completed_at) : null,
    createdAt:       String(r.created_at),
    updatedAt:       String(r.updated_at),
    pages:           Array.isArray(r.pages) ? r.pages as ArticleCluster["pages"] : [],
  };
}
