import '../types';
import { Router } from 'express';
import Joi from 'joi';
import { loggableDate } from './logDate';
import * as fitnessService from '../services/fitness.service';
import { requireAuth } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';

export const fitnessRouter = Router();

fitnessRouter.use(requireAuth);

fitnessRouter.get('/exercises', async (req, res, next) => {
  try {
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
    const exercises = await fitnessService.getExercises(category, limit);
    res.json({ success: true, data: exercises });
  } catch (err) {
    next(err);
  }
});

fitnessRouter.get('/exercises/:id', async (req, res, next) => {
  try {
    const exercise = await fitnessService.getExerciseById(req.params.id);
    res.json({ success: true, data: exercise });
  } catch (err) {
    next(err);
  }
});

fitnessRouter.get('/workouts', async (req, res, next) => {
  try {
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 30;
    const workouts = await fitnessService.getWorkouts(req.userId, days);
    res.json({ success: true, data: workouts });
  } catch (err) {
    next(err);
  }
});

fitnessRouter.get('/workouts/:id', async (req, res, next) => {
  try {
    const workout = await fitnessService.getWorkoutById(req.userId, req.params.id);
    res.json({ success: true, data: workout });
  } catch (err) {
    next(err);
  }
});

const createWorkoutSchema = Joi.object({
  date: loggableDate().required(),
  durationMinutes: Joi.number().integer().min(0).required(),
  workoutType: Joi.string().required(),
  intensity: Joi.string().valid('light', 'moderate', 'intense'),
  caloriesBurned: Joi.number().min(0),
  notes: Joi.string().allow('').max(2000),
});

fitnessRouter.post('/workouts', validate(createWorkoutSchema), async (req, res, next) => {
  try {
    const workout = await fitnessService.createWorkout(req.userId, req.body);
    res.status(201).json({ success: true, data: workout });
  } catch (err) {
    next(err);
  }
});

const addExerciseSchema = Joi.object({
  exerciseId: Joi.string().uuid().required(),
  setNumber: Joi.number().integer().min(1),
  reps: Joi.number().integer().min(0),
  weightKg: Joi.number().min(0),
  durationSeconds: Joi.number().integer().min(0),
  rpe: Joi.number().min(1).max(10),
});

fitnessRouter.post('/workouts/:id/exercises', validate(addExerciseSchema), async (req, res, next) => {
  try {
    const entry = await fitnessService.addExerciseToWorkout(
      req.userId,
      req.params.id,
      req.body
    );
    res.status(201).json({ success: true, data: entry });
  } catch (err) {
    next(err);
  }
});

fitnessRouter.delete('/workouts/:id', async (req, res, next) => {
  try {
    await fitnessService.deleteWorkout(req.userId, req.params.id);
    res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
});

fitnessRouter.get('/records', async (req, res, next) => {
  try {
    const records = await fitnessService.getPersonalRecords(req.userId);
    res.json({ success: true, data: records });
  } catch (err) {
    next(err);
  }
});

fitnessRouter.get('/summary', async (req, res, next) => {
  try {
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 7;
    const summary = await fitnessService.getSummary(req.userId, days);
    res.json({ success: true, data: summary });
  } catch (err) {
    next(err);
  }
});
