import '../types';
import { Router } from 'express';
import Joi from 'joi';
import * as aiService from '../services/ai.service';
import { requireAuth } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';

export const aiRouter = Router();

aiRouter.use(requireAuth);

const chatSchema = Joi.object({
  message: Joi.string().min(1).max(4000).required(),
  conversationId: Joi.string().uuid(),
});

aiRouter.post('/chat', validate(chatSchema), async (req, res, next) => {
  try {
    const { message, conversationId } = req.body;
    const result = await aiService.chat(req.userId, message, conversationId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

aiRouter.get('/daily-brief', async (req, res, next) => {
  try {
    const brief = await aiService.getDailyBrief(req.userId);
    res.json({ success: true, data: brief });
  } catch (err) {
    next(err);
  }
});

const mealPlanSchema = Joi.object({
  days: Joi.number().integer().min(1).max(14),
});

aiRouter.post('/meal-plan', validate(mealPlanSchema), async (req, res, next) => {
  try {
    const days = req.body.days ?? 3;
    const plan = await aiService.generateMealPlan(req.userId, days);
    res.json({ success: true, data: plan });
  } catch (err) {
    next(err);
  }
});

const workoutPlanSchema = Joi.object({
  equipment: Joi.string().allow('').max(200),
  durationMinutes: Joi.number().integer().min(5).max(180),
});

aiRouter.post('/workout-plan', validate(workoutPlanSchema), async (req, res, next) => {
  try {
    const { equipment, durationMinutes } = req.body;
    const plan = await aiService.generateWorkoutPlan(
      req.userId,
      equipment ?? '',
      durationMinutes ?? 30
    );
    res.json({ success: true, data: plan });
  } catch (err) {
    next(err);
  }
});

aiRouter.get('/conversations', async (req, res, next) => {
  try {
    const conversations = await aiService.getConversations(req.userId);
    res.json({ success: true, data: conversations });
  } catch (err) {
    next(err);
  }
});

aiRouter.get('/conversations/:id', async (req, res, next) => {
  try {
    const conversation = await aiService.getConversationById(req.userId, req.params.id);
    res.json({ success: true, data: conversation });
  } catch (err) {
    next(err);
  }
});
