import { Router, type IRouter } from "express";
import healthRouter from "./health";
import aiRouter from "./ai";
import newsRouter from "./news";
import chartRouter from "./chart.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(aiRouter);
router.use(newsRouter);
router.use(chartRouter);

export default router;
