import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { MongoUser } from "../models/User.js";

const JWT_SECRET = process.env.SESSION_SECRET ?? "groeax-dev-secret-change-in-prod";

declare global {
  namespace Express {
    interface Request {
      mongoUserId?: string;
    }
  }
}

export async function mongoAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Missing or invalid authorization header." });
      return;
    }

    const token = authHeader.slice(7);
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string };

    const user = await MongoUser.findById(payload.sub).select("-password");
    if (!user) {
      res.status(401).json({ error: "User not found." });
      return;
    }

    req.mongoUserId = String(user._id);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token." });
  }
}
