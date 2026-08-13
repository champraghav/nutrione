import '../types';
import { Router } from 'express';
import Joi from 'joi';
import * as userService from '../services/user.service';
import { requireAuth } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';

export const userRouter = Router();

userRouter.use(requireAuth);

userRouter.get('/me', async (req, res, next) => {
  try {
    const user = await userService.getMe(req.userId);
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

const updateSchema = Joi.object({
  firstName: Joi.string().max(100),
  lastName: Joi.string().max(100),
  dateOfBirth: Joi.string().isoDate(),
  sex: Joi.string().valid('male', 'female', 'other'),
  heightCm: Joi.number().positive().max(300),
  weightKg: Joi.number().positive().max(500),
  activityLevel: Joi.string().valid('sedentary', 'light', 'moderate', 'active', 'very_active'),
  timezone: Joi.string(),
});

userRouter.put('/me', validate(updateSchema), async (req, res, next) => {
  try {
    const user = await userService.updateMe(req.userId, req.body);
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

userRouter.delete('/me', async (req, res, next) => {
  try {
    await userService.deleteMe(req.userId);
    res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
});
