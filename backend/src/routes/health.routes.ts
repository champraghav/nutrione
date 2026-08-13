import '../types';
import { Router } from 'express';
import Joi from 'joi';
import * as healthScoreService from '../services/health-score.service';
import { requireAuth } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';

export const healthRouter = Router();

healthRouter.use(requireAuth);

healthRouter.get('/score', async (req, res, next) => {
  try {
    const score = await healthScoreService.getTodayScore(req.userId);
    res.json({ success: true, data: score });
  } catch (err) {
    next(err);
  }
});

healthRouter.get('/score/history', async (req, res, next) => {
  try {
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 30;
    const history = await healthScoreService.getScoreHistory(req.userId, days);
    res.json({ success: true, data: history });
  } catch (err) {
    next(err);
  }
});

healthRouter.get('/metrics', async (req, res, next) => {
  try {
    const type = typeof req.query.type === 'string' ? req.query.type : undefined;
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 30;
    const metrics = await healthScoreService.getMetrics(req.userId, type, days);
    res.json({ success: true, data: metrics });
  } catch (err) {
    next(err);
  }
});

const logMetricSchema = Joi.object({
  type: Joi.string().required(),
  value: Joi.number().required(),
  unit: Joi.string(),
});

healthRouter.post('/metrics', validate(logMetricSchema), async (req, res, next) => {
  try {
    const { type, value, unit } = req.body;
    const metric = await healthScoreService.logMetric(req.userId, type, value, unit);
    res.status(201).json({ success: true, data: metric });
  } catch (err) {
    next(err);
  }
});

healthRouter.get('/timeline', async (req, res, next) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const timeline = await healthScoreService.getTimeline(req.userId, limit);
    res.json({ success: true, data: timeline });
  } catch (err) {
    next(err);
  }
});

healthRouter.get('/profile', async (req, res, next) => {
  try {
    const profile = await healthScoreService.getHealthProfile(req.userId);
    res.json({ success: true, data: profile });
  } catch (err) {
    next(err);
  }
});

const updateProfileSchema = Joi.object({
  dateOfBirth: Joi.string().isoDate(),
  sex: Joi.string().valid('male', 'female', 'other'),
  heightCm: Joi.number().positive().max(300),
  weightKg: Joi.number().positive().max(500),
  activityLevel: Joi.string().valid('sedentary', 'light', 'moderate', 'active', 'very_active'),
});

healthRouter.put('/profile', validate(updateProfileSchema), async (req, res, next) => {
  try {
    const profile = await healthScoreService.updateHealthProfile(req.userId, req.body);
    res.json({ success: true, data: profile });
  } catch (err) {
    next(err);
  }
});
