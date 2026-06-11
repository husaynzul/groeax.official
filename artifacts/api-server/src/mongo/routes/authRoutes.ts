import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { MongoUser } from "../models/User.js";

const router = Router();
const JWT_SECRET = process.env.SESSION_SECRET ?? "groeax-dev-secret-change-in-prod";
const JWT_EXPIRES = "30d";

// POST /api/mongo/auth/register
router.post("/register", async (req: Request, res: Response) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: "username, email and password are required." });
    }

    const existing = await MongoUser.findOne({ $or: [{ email }, { username }] });
    if (existing) {
      const field = existing.email === email ? "email" : "username";
      return res.status(409).json({ error: `A user with that ${field} already exists.` });
    }

    const user = await MongoUser.create({ username, email, password });

    const token = jwt.sign({ sub: String(user._id) }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

    return res.status(201).json({
      token,
      user: { id: user._id, username: user.username, email: user.email, createdAt: user.createdAt },
    });
  } catch (err) {
    console.error("POST /mongo/auth/register error:", err);
    return res.status(500).json({ error: "Registration failed." });
  }
});

// POST /api/mongo/auth/login
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, username, password } = req.body;

    if (!password || (!email && !username)) {
      return res.status(400).json({ error: "Provide (email or username) and password." });
    }

    const query = email ? { email } : { username };
    const user = await MongoUser.findOne(query);
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    const valid = await user.comparePassword(password);
    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    const token = jwt.sign({ sub: String(user._id) }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

    return res.json({
      token,
      user: { id: user._id, username: user.username, email: user.email, createdAt: user.createdAt },
    });
  } catch (err) {
    console.error("POST /mongo/auth/login error:", err);
    return res.status(500).json({ error: "Login failed." });
  }
});

export default router;
