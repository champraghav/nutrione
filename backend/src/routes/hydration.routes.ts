import '../types';
import { Router } from 'express';
import Joi from 'joi';
import { loggableDate } from './logDate';
import * as hydrationService from '../services/hydration.service';
import { requireAuth } from '../middleware/auth.middleware';
import { dateParam } from './dateParam';
import { validate } from '../middleware/validate.middleware';

export const hydrationRouter = Router();

hydrationRouter.use(requireAuth);



hydrationRouter.get('/', async (req, res, next) => {
  try {
    const date = await dateParam(req.query.date, req.userId);
    const data = await hydrationService.getHydrationForDate(req.userId, date);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

hydrationRouter.get('/history', async (req, res, next) => {
  try {
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 14;
    const history = await hydrationService.getHydrationHistory(req.userId, days);
    res.json({ success: true, data: history });
  } catch (err) {
    next(err);
  }
});

const addWaterSchema = Joi.object({
  amountMl: Joi.number().integer().min(1).max(3000).required(),
  date: loggableDate(),
});

hydrationRouter.post('/', validate(addWaterSchema), async (req, res, next) => {
  try {
    const { amountMl, date } = req.body as { amountMl: number; date?: string };
    const data = await hydrationService.addWater(req.userId, await dateParam(date, req.userId), amountMl);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

hydrationRouter.delete('/:id', async (req, res, next) => {
  try {
    await hydrationService.removeEntry(req.userId, req.params.id);
    res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
});
