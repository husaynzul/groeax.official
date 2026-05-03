import { Router, type IRouter } from "express";
import healthRouter from "./health";
import aiRouter from "./ai";
import newsRouter from "./news";
import chartRouter from "./chart.js";
import brokerRouter from "./broker.js";
import pricesRouter from "./prices.js";
import mt5Router from "./mt5.js";
import intelligenceRouter from "./intelligence.js";
import tradingSignalRouter from "./tradingSignal.js";
import marketIntelligenceRouter from "./marketIntelligence.js";
import authRouter from "./auth.js";
import paymentRouter from "./payment.js";

const router: IRouter = Router();

router.use(authRouter);
router.use(paymentRouter);
router.use(healthRouter);
router.use(aiRouter);
router.use(newsRouter);
router.use(chartRouter);
router.use(brokerRouter);
router.use(pricesRouter);
router.use(mt5Router);
router.use(intelligenceRouter);
router.use(tradingSignalRouter);
router.use(marketIntelligenceRouter);

export default router;
