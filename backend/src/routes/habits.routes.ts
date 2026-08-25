import '../types';
import { Router } from 'express';
import Joi from 'joi';
import { loggableDate } from './logDate';
import * as habitsService from '../services/habits.service';
import { requireAuth } from '../middleware/auth.middleware';
import { dateParam } from './dateParam';
import { validate } from '../middleware/validate.middleware';

export const habitsRouter = Router();

habitsRouter.use(requireAuth);



habitsRouter.get('/', async (req, res, next) => {
  try {
    const data = await habitsService.listHabits(req.userId, await dateParam(req.query.date, req.userId));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

habitsRouter.get('/summary', async (req, res, next) => {
  try {
    const data = await habitsService.getHabitsSummary(req.userId, await dateParam(req.query.date, req.userId));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

habitsRouter.get('/suggestions', (_req, res) => {
  res.json({ success: true, data: habitsService.SUGGESTED_HABITS });
});

const habitSchema = Joi.object({
  name: Joi.string().trim().min(1).max(80).required(),
  icon: Joi.string().max(8).allow(''),
  cadence: Joi.string().valid('daily', 'weekly'),
  targetPerDay: Joi.number().integer().min(1).max(50),
  daysOfWeek: Joi.array().items(Joi.number().integer().min(0).max(6)).max(7).allow(null),
  reminderTime: Joi.string()
    .pattern(/^\d{2}:\d{2}$/)
    .allow(null, ''),
});

habitsRouter.post('/', validate(habitSchema), async (req, res, next) => {
  try {
    const data = await habitsService.createHabit(req.userId, req.body as habitsService.HabitInput);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

habitsRouter.put('/:id', validate(habitSchema), async (req, res, next) => {
  try {
    await habitsService.updateHabit(req.userId, req.params.id, req.body as habitsService.HabitInput);
    const data = await habitsService.listHabits(req.userId, await dateParam(undefined, req.userId));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

habitsRouter.delete('/:id', async (req, res, next) => {
  try {
    await habitsService.archiveHabit(req.userId, req.params.id);
    res.json({ success: true, data: { archived: true } });
  } catch (err) {
    next(err);
  }
});

const checkSchema = Joi.object({
  date: loggableDate().required(),
  count: Joi.number().integer().min(0).max(500).required(),
});

habitsRouter.post('/:id/check', validate(checkSchema), async (req, res, next) => {
  try {
    const { date, count } = req.body as { date: string; count: number };
    const data = await habitsService.setEntry(req.userId, req.params.id, date.slice(0, 10), count);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});
