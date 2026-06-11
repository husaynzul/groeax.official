import { Router } from "express";
import authRoutes from "./authRoutes.js";
import tradeRoutes from "./tradeRoutes.js";

const mongoRouter = Router();

mongoRouter.use("/auth", authRoutes);
mongoRouter.use("/trades", tradeRoutes);

export default mongoRouter;
