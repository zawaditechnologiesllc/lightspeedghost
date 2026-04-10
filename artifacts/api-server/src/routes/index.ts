import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import documentsRouter from "./documents";
import writingRouter from "./writing";
import revisionRouter from "./revision";
import humanizerRouter from "./humanizer";
import plagiarismRouter from "./plagiarism";
import stemRouter from "./stem";
import studyRouter from "./study";
import filesRouter from "./files";
import adminRouter from "./admin";
import paymentsRouter from "./payments";
import pwaRouter from "./pwa";
import referralRouter from "./referral";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(documentsRouter);
router.use(writingRouter);
router.use(revisionRouter);
router.use(humanizerRouter);
router.use(plagiarismRouter);
router.use(stemRouter);
router.use(studyRouter);
router.use(filesRouter);
router.use(adminRouter);
router.use(paymentsRouter);
router.use(pwaRouter);
router.use(referralRouter);

export default router;
