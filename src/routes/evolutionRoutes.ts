import { Router, Request, Response } from "express";

export const evolutionRouter = Router();

// GET /api/evolution/candidates
evolutionRouter.get("/candidates", (req: Request, res: Response) => {
  res.json({
    success: true,
    candidates: [],
    labStatus: {
      active: true,
      currentGeneration: 42,
      bestCandidateScore: 0.942
    }
  });
});

// GET /api/pipeline/status
evolutionRouter.get("/pipeline/status", (req: Request, res: Response) => {
  res.json({
    success: true,
    pipeline: {
      stage: "IDLE",
      activeJobs: 0,
      completedJobs: 148,
      lastRunTime: new Date().toISOString()
    }
  });
});
