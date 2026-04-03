import { Router, type IRouter } from "express";
import healthRouter from "./health";
import documentsRouter from "./documents";
import writingRouter from "./writing";
import revisionRouter from "./revision";
import plagiarismRouter from "./plagiarism";
import stemRouter from "./stem";
import studyRouter from "./study";

const router: IRouter = Router();

router.use(healthRouter);
router.use(documentsRouter);
router.use(writingRouter);
router.use(revisionRouter);
router.use(plagiarismRouter);
router.use(stemRouter);
router.use(studyRouter);

export default router;
