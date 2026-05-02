import { Router, type IRouter } from "express";
import healthRouter from "./health";
import aiRouter from "./ai";
import newsRouter from "./news";
import chartRouter from "./chart.js";
import brokerRouter from "./broker.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(aiRouter);
router.use(newsRouter);
router.use(chartRouter);
router.use(brokerRouter);

export default router;
