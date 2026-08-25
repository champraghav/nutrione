import '../types';
import { Router } from 'express';
import Joi from 'joi';
import * as goalsService from '../services/goals.service';
import { requireAuth } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';

export const goalsRouter = Router();

goalsRouter.use(requireAuth);

goalsRouter.get('/', async (req, res, next) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const goals = await goalsService.listGoals(req.userId, status);
    res.json({ success: true, data: goals });
  } catch (err) {
    next(err);
  }
});

const createSchema = Joi.object({
  type: Joi.string().max(100).required(),
  targetValue: Joi.number().positive().required(),
  currentValue: Joi.number().min(0),
  unit: Joi.string().max(20).allow(''),
  targetDate: Joi.string().isoDate(),
});

goalsRouter.post('/', validate(createSchema), async (req, res, next) => {
  try {
    const goal = await goalsService.createGoal(req.userId, req.body);
    res.status(201).json({ success: true, data: goal });
  } catch (err) {
    next(err);
  }
});

const updateSchema = Joi.object({
  currentValue: Joi.number().min(0),
  targetValue: Joi.number().positive(),
  status: Joi.string().valid('active', 'completed', 'abandoned'),
});

goalsRouter.put('/:id', validate(updateSchema), async (req, res, next) => {
  try {
    const goal = await goalsService.updateGoal(req.userId, req.params.id, req.body);
    res.json({ success: true, data: goal });
  } catch (err) {
    next(err);
  }
});

goalsRouter.delete('/:id', async (req, res, next) => {
  try {
    await goalsService.deleteGoal(req.userId, req.params.id);
    res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
});
