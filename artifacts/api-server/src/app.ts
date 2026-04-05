import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { authMiddleware } from "./middlewares/auth";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : true;

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);
// Webhook routes need raw body for signature verification
app.use(/\/api\/payments\/webhook\//, express.raw({ type: "*/*", limit: "5mb" }));

// All other routes use JSON
app.use((req, _res, next) => {
  if (req.headers["content-type"]?.startsWith("application/json") && !Buffer.isBuffer(req.body)) {
    express.json()(req, _res, next);
  } else {
    next();
  }
});
app.use(express.urlencoded({ extended: true }));

// Attach userId from Supabase JWT on every request
app.use(authMiddleware);

app.use("/api", router);

export default app;
