import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import { fileURLToPath } from "url";
import router from "./routes";
import mongoRouter from "./mongo/routes/index.js";
import { connectMongoDB } from "./mongo/config/db.js";
import { logger } from "./lib/logger";
import { optionalAuthMiddleware } from "./middleware/auth.js";

// Connect MongoDB (non-blocking — app still works if MONGO_URI is not set)
connectMongoDB();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app: Express = express();

// CORS — set ALLOWED_ORIGINS in production (comma-separated list of frontend URLs).
// Example: ALLOWED_ORIGINS=https://myapp.vercel.app,https://www.myapp.com
const rawOrigins = process.env.ALLOWED_ORIGINS ?? "*";
const allowedOrigins = rawOrigins === "*"
  ? true
  : rawOrigins.split(",").map((o) => o.trim());

app.use(cors({ origin: allowedOrigins, credentials: true }));

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
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(optionalAuthMiddleware);

app.use("/api", router);
app.use("/api/mongo", mongoRouter);

const frontendDist = path.resolve(__dirname, "../../trading-journal/dist/public");
app.use(express.static(frontendDist));
app.get("/{*path}", (_req, res) => {
  res.sendFile(path.join(frontendDist, "index.html"));
});

export default app;
