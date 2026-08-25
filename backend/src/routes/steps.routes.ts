import '../types';
import { Router } from 'express';
import Joi from 'joi';
import * as stepsService from '../services/steps.service';
import { requireAuth } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';

export const stepsRouter = Router();

stepsRouter.use(requireAuth);

function dateParam(value: unknown): string {
  return typeof value === 'string' && value.length >= 10
    ? value.slice(0, 10)
    : new Date().toISOString().slice(0, 10);
}

stepsRouter.get('/', async (req, res, next) => {
  try {
    res.json({ success: true, data: await stepsService.getSteps(req.userId, dateParam(req.query.date)) });
  } catch (err) {
    next(err);
  }
});

stepsRouter.get('/history', async (req, res, next) => {
  try {
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 14;
    res.json({ success: true, data: await stepsService.getStepHistory(req.userId, days) });
  } catch (err) {
    next(err);
  }
});

stepsRouter.post(
  '/',
  validate(Joi.object({ date: Joi.string().min(10).required(), steps: Joi.number().integer().min(0).max(200000).required() })),
  async (req, res, next) => {
    try {
      const { date, steps } = req.body as { date: string; steps: number };
      res.json({ success: true, data: await stepsService.setSteps(req.userId, date.slice(0, 10), steps) });
    } catch (err) {
      next(err);
    }
  }
);
