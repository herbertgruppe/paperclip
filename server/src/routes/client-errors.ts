import { Router } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { logger } from "../middleware/logger.js";

const clientErrorSchema = z.object({
  message: z.string().max(2000),
  stack: z.string().max(10000).optional(),
  componentStack: z.string().max(10000).optional(),
  url: z.string().max(2000),
  userAgent: z.string().max(500),
});

export function clientErrorRoutes() {
  const router = Router();

  router.post("/client-errors", validate(clientErrorSchema), (req, res) => {
    const { message, stack, componentStack, url, userAgent } = req.body as z.infer<typeof clientErrorSchema>;
    logger.warn({ message, stack, componentStack, url, userAgent }, "client-error");
    res.status(204).end();
  });

  return router;
}
