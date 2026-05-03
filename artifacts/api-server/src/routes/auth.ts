import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

const JWT_SECRET = process.env.SESSION_SECRET ?? "groeax-dev-secret-change-in-prod";
const JWT_EXPIRES = "30d";

function signToken(userId: number) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

function safeUser(u: typeof usersTable.$inferSelect) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    plan: u.plan,
    planExpiresAt: u.planExpiresAt,
    createdAt: u.createdAt,
  };
}

router.post("/auth/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body as { name?: string; email?: string; password?: string };
    if (!name || !email || !password) {
      res.status(400).json({ error: "Name, email, and password are required." });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters." });
      return;
    }

    const existing = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase().trim())).limit(1);
    if (existing.length > 0) {
      res.status(409).json({ error: "An account with this email already exists." });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const [user] = await db.insert(usersTable).values({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash,
      plan: "free",
    }).returning();

    const token = signToken(user.id);
    res.status(201).json({ token, user: safeUser(user) });
  } catch (err) {
    req.log.error(err, "signup error");
    res.status(500).json({ error: "Internal server error." });
  }
});

router.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required." });
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase().trim())).limit(1);
    if (!user) {
      res.status(401).json({ error: "Invalid email or password." });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid email or password." });
      return;
    }

    const token = signToken(user.id);
    res.json({ token, user: safeUser(user) });
  } catch (err) {
    req.log.error(err, "login error");
    res.status(500).json({ error: "Internal server error." });
  }
});

router.get("/auth/me", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized." });
      return;
    }
    const token = authHeader.slice(7);
    const payload = jwt.verify(token, JWT_SECRET) as { sub: number };
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.sub)).limit(1);
    if (!user) {
      res.status(401).json({ error: "User not found." });
      return;
    }
    res.json({ user: safeUser(user) });
  } catch {
    res.status(401).json({ error: "Invalid or expired token." });
  }
});

router.post("/auth/subscribe", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized." });
      return;
    }
    const token = authHeader.slice(7);
    const payload = jwt.verify(token, JWT_SECRET) as { sub: number };

    const { plan, email, txHash } = req.body as { plan?: string; email?: string; txHash?: string };
    if (plan !== "monthly" && plan !== "yearly") {
      res.status(400).json({ error: "Plan must be 'monthly' or 'yearly'." });
      return;
    }

    if (plan === "yearly" && (!email || !txHash)) {
      res.status(400).json({ error: "For yearly plan, email and transaction hash are required." });
      return;
    }

    const now = new Date();
    const planExpiresAt = plan === "yearly"
      ? new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())
      : new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

    req.log.info({ userId: payload.sub, plan, email, txHash }, "Subscription");

    const [user] = await db.update(usersTable)
      .set({ plan, planExpiresAt })
      .where(eq(usersTable.id, payload.sub))
      .returning();

    res.json({ user: safeUser(user) });
  } catch (err) {
    req.log.error(err, "subscribe error");
    res.status(401).json({ error: "Invalid or expired token." });
  }
});

export default router;
