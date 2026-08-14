import '../types';
import { Router } from 'express';
import Joi from 'joi';
import * as importService from '../services/import.service';
import { requireAuth } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';

export const importRouter = Router();

importRouter.use(requireAuth);

const previewSchema = Joi.object({
  csv: Joi.string().min(2).max(20 * 1024 * 1024).required(),
  dayFirst: Joi.boolean(),
});

importRouter.post('/preview', validate(previewSchema), async (req, res, next) => {
  try {
    const { csv, dayFirst } = req.body as { csv: string; dayFirst?: boolean };
    const preview = importService.buildPreview(csv, dayFirst ?? false);
    // The full row set is echoed back so commit re-parses nothing and the
    // user commits exactly what they were shown.
    res.json({ success: true, data: preview });
  } catch (err) {
    next(err);
  }
});

const commitSchema = Joi.object({
  csv: Joi.string().min(2).max(20 * 1024 * 1024).required(),
  dayFirst: Joi.boolean(),
});

importRouter.post('/commit', validate(commitSchema), async (req, res, next) => {
  try {
    const { csv, dayFirst } = req.body as { csv: string; dayFirst?: boolean };
    const preview = importService.buildPreview(csv, dayFirst ?? false);
    const result = await importService.commitImport(req.userId, preview);
    res.status(201).json({ success: true, data: { ...result, kind: preview.kind } });
  } catch (err) {
    next(err);
  }
});
