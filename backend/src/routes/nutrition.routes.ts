import '../types';
import { Router } from 'express';
import Joi from 'joi';
import * as nutritionService from '../services/nutrition.service';
import * as visionService from '../services/vision.service';
import { requireAuth } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';

export const nutritionRouter = Router();

nutritionRouter.use(requireAuth);

nutritionRouter.get('/foods', async (req, res, next) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const foods = await nutritionService.searchFoods(req.userId, q, limit);
    res.json({ success: true, data: foods });
  } catch (err) {
    next(err);
  }
});

nutritionRouter.get('/foods/barcode/:barcode', async (req, res, next) => {
  try {
    const food = await nutritionService.getFoodByBarcode(req.params.barcode);
    res.json({ success: true, data: food });
  } catch (err) {
    next(err);
  }
});

nutritionRouter.get('/foods/:id', async (req, res, next) => {
  try {
    const food = await nutritionService.getFoodById(req.userId, req.params.id);
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
    const summary = await nutritionService.getDailyNutrition(req.userId, date);
    res.json({ success: true, data: summary });
  } catch (err) {
    next(err);
  }
});

nutritionRouter.get('/gaps', async (req, res, next) => {
  try {
    const date = typeof req.query.date === 'string' ? req.query.date : new Date().toISOString().slice(0, 10);
    const gaps = await nutritionService.getNutrientGaps(req.userId, date);
    res.json({ success: true, data: gaps });
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

const analyzePhotoSchema = Joi.object({
  // Accepts a bare base64 payload or a full data: URL from the browser.
  image: Joi.string().min(100).required(),
  mediaType: Joi.string().valid('image/jpeg', 'image/png', 'image/webp'),
});

nutritionRouter.post('/analyze-photo', validate(analyzePhotoSchema), async (req, res, next) => {
  try {
    const { image, mediaType } = req.body as { image: string; mediaType?: string };

    let base64 = image;
    let type = mediaType ?? 'image/jpeg';
    const dataUrl = image.match(/^data:(image\/[a-zA-Z+]+);base64,(.*)$/s);
    if (dataUrl) {
      type = dataUrl[1];
      base64 = dataUrl[2];
    }

    const analysis = await visionService.analyzePhoto(req.userId, base64, type);
    res.json({ success: true, data: analysis });
  } catch (err) {
    next(err);
  }
});

const bulkLogSchema = Joi.object({
  date: Joi.string().isoDate().required(),
  mealType: Joi.string().valid('breakfast', 'lunch', 'dinner', 'snack'),
  items: Joi.array()
    .items(
      Joi.object({
        foodId: Joi.string().uuid().required(),
        quantity: Joi.number().positive().required(),
        unit: Joi.string().required(),
      })
    )
    .min(1)
    .max(30)
    .required(),
});

nutritionRouter.post('/meals/bulk', validate(bulkLogSchema), async (req, res, next) => {
  try {
    const { date, mealType, items } = req.body as {
      date: string;
      mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
      items: Array<{ foodId: string; quantity: number; unit: string }>;
    };

    const logged = [];
    for (const item of items) {
      logged.push(
        await nutritionService.addMealItem(req.userId, {
          foodId: item.foodId,
          quantity: item.quantity,
          unit: item.unit,
          logDate: date,
          mealType,
        })
      );
    }

    res.status(201).json({ success: true, data: { logged: logged.length, items: logged } });
  } catch (err) {
    next(err);
  }
});
