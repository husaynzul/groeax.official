import { Router, type IRouter } from "express";
import healthRouter from "./health";
import aiRouter from "./ai";
import newsRouter from "./news";

const router: IRouter = Router();

router.use(healthRouter);
router.use(aiRouter);
router.use(newsRouter);

export default router;
