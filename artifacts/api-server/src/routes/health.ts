import { Router, type IRouter, type Request, type Response } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { cacheHealthy } from "../lib/cache.js";

const router: IRouter = Router();

router.get("/healthz", async (_req: Request, res: Response) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");
  const data = HealthCheckResponse.parse({ status: "ok" });
  const cacheOk = await cacheHealthy();
  res.json({
    ...data,
    uptimeSeconds: Math.floor(process.uptime()),
    cache: cacheOk ? "redis:upstash" : "disabled",
  });
});

export default router;
