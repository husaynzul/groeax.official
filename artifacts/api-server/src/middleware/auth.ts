import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const JWT_SECRET = process.env.SESSION_SECRET ?? "groeax-dev-secret-change-in-prod";

declare global {
  namespace Express {
    interface Request {
      userId?: number;
      userPlan?: string;
    }
  }
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid authorization header." });
    }

    const token = authHeader.slice(7);
    const payload = jwt.verify(token, JWT_SECRET) as { sub: number };

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.sub)).limit(1);
    if (!user) {
      return res.status(401).json({ error: "User not found." });
    }

    req.userId = user.id;
    req.userPlan = user.plan;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token." });
  }
}

export function premiumMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!req.userId || !req.userPlan) {
    return res.status(401).json({ error: "Unauthorized." });
  }

  const isPremium = req.userPlan !== "free";
  if (!isPremium) {
    return res.status(403).json({
      error: "This feature requires a Premium subscription.",
      code: "PREMIUM_REQUIRED",
      plan: req.userPlan,
    });
  }

  next();
}

export function optionalAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const payload = jwt.verify(token, JWT_SECRET) as { sub: number };
      req.userId = payload.sub;
    }
  } catch {}
  next();
}
