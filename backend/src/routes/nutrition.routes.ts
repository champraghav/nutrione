import '../types';
import { Router } from 'express';
import Joi from 'joi';
import * as nutritionService from '../services/nutrition.service';
import { requireAuth } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';

export const nutritionRouter = Router();

nutritionRouter.use(requireAuth);

nutritionRouter.get('/foods', async (req, res, next) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const foods = await nutritionService.searchFoods(q, limit);
    res.json({ success: true, data: foods });
  } catch (err) {
    next(err);
  }
});

nutritionRouter.get('/foods/:id', async (req, res, next) => {
  try {
    const food = await nutritionService.getFoodById(req.params.id);
    res.json({ success: true, data: food });
  } catch (err) {
    next(err);
  }
});

nutritionRouter.get('/logs', async (req, res, next) => {
  try {
    const date = typeof req.query.date === 'string' ? req.query.date : new Date().toISOString().slice(0, 10);
    const logs = await nutritionService.getLogsForDate(req.userId, date);
    res.json({ success: true, data: logs });
  } catch (err) {
    next(err);
  }
});

nutritionRouter.get('/summary', async (req, res, next) => {
  try {
    const date = typeof req.query.date === 'string' ? req.query.date : new Date().toISOString().slice(0, 10);
    const summary = await nutritionService.getSummary(req.userId, date);
    res.json({ success: true, data: summary });
  } catch (err) {
    next(err);
  }
});

nutritionRouter.get('/history', async (req, res, next) => {
  try {
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 30;
    const history = await nutritionService.getHistory(req.userId, days);
    res.json({ success: true, data: history });
  } catch (err) {
    next(err);
  }
});

const addMealSchema = Joi.object({
  foodId: Joi.string().uuid().required(),
  quantity: Joi.number().positive().required(),
  unit: Joi.string().required(),
  date: Joi.string().isoDate().required(),
  mealType: Joi.string().valid('breakfast', 'lunch', 'dinner', 'snack'),
});

nutritionRouter.post('/meals', validate(addMealSchema), async (req, res, next) => {
  try {
    const { foodId, quantity, unit, date, mealType } = req.body;
    const item = await nutritionService.addMealItem(req.userId, {
      foodId,
      quantity,
      unit,
      logDate: date,
      mealType,
    });
    res.status(201).json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
});

nutritionRouter.delete('/meals/:id', async (req, res, next) => {
  try {
    await nutritionService.removeMealItem(req.userId, req.params.id);
    res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
});
