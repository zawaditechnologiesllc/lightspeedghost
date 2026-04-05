import { Router, type IRouter, type Request, type Response } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/healthz", (_req: Request, res: Response) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json({ ...data, uptimeSeconds: Math.floor(process.uptime()) });
});

export default router;
