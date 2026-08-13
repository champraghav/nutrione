import '../types';
import { Router } from 'express';
import Joi from 'joi';
import * as sleepService from '../services/sleep.service';
import { requireAuth } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';

export const sleepRouter = Router();

sleepRouter.use(requireAuth);

sleepRouter.get('/', async (req, res, next) => {
  try {
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 30;
    const logs = await sleepService.getSleepLogs(req.userId, days);
    res.json({ success: true, data: logs });
  } catch (err) {
    next(err);
  }
});

sleepRouter.get('/trend/:period', async (req, res, next) => {
  try {
    const period = req.params.period === 'month' ? 'month' : 'week';
    const trend = await sleepService.getTrend(req.userId, period);
    res.json({ success: true, data: trend });
  } catch (err) {
    next(err);
  }
});

sleepRouter.get('/analysis/:date', async (req, res, next) => {
  try {
    const analysis = await sleepService.getAnalysis(req.userId, req.params.date);
    res.json({ success: true, data: analysis });
  } catch (err) {
    next(err);
  }
});

sleepRouter.get('/:date', async (req, res, next) => {
  try {
    const session = await sleepService.getSleepByDate(req.userId, req.params.date);
    res.json({ success: true, data: session });
  } catch (err) {
    next(err);
  }
});

const logSleepSchema = Joi.object({
  date: Joi.string().isoDate().required(),
  bedtime: Joi.string().required(),
  wakeTime: Joi.string().required(),
  quality: Joi.number().integer().min(1).max(5),
  notes: Joi.string().allow('').max(2000),
});

sleepRouter.post('/', validate(logSleepSchema), async (req, res, next) => {
  try {
    const session = await sleepService.logSleep(req.userId, req.body);
    res.status(201).json({ success: true, data: session });
  } catch (err) {
    next(err);
  }
});

const updateSleepSchema = Joi.object({
  bedtime: Joi.string(),
  wakeTime: Joi.string(),
  quality: Joi.number().integer().min(1).max(5),
  notes: Joi.string().allow('').max(2000),
});

sleepRouter.put('/:id', validate(updateSleepSchema), async (req, res, next) => {
  try {
    const session = await sleepService.updateSleep(req.userId, req.params.id, req.body);
    res.json({ success: true, data: session });
  } catch (err) {
    next(err);
  }
});

sleepRouter.delete('/:id', async (req, res, next) => {
  try {
    await sleepService.deleteSleep(req.userId, req.params.id);
    res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
});
