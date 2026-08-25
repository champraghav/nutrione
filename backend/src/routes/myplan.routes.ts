import '../types';
import { Router } from 'express';
import Joi from 'joi';
import { loggableDate } from './logDate';
import * as coachService from '../services/coach.service';
import * as plansService from '../services/plans.service';
import { requireAuth } from '../middleware/auth.middleware';
import { dateParam } from './dateParam';
import { validate } from '../middleware/validate.middleware';

/**
 * The client's side of coaching: the plan they were given, how closely they
 * followed it, and control over who can see their data.
 */
export const myPlanRouter = Router();

myPlanRouter.use(requireAuth);



myPlanRouter.get('/', async (req, res, next) => {
  try {
    const date = await dateParam(req.query.date, req.userId);
    const [plans, adherence] = await Promise.all([
      plansService.plansForUserOnDate(req.userId, date),
      plansService.adherenceForDate(req.userId, date),
    ]);
    res.json({ success: true, data: { date, plans, adherence } });
  } catch (err) {
    next(err);
  }
});

myPlanRouter.post(
  '/items/:itemId/check',
  validate(Joi.object({ date: loggableDate().required(), done: Joi.boolean().required() })),
  async (req, res, next) => {
    try {
      const { date, done } = req.body as { date: string; done: boolean };
      await plansService.setItemCheckin(req.userId, req.params.itemId, date.slice(0, 10), done);
      const [plans, adherence] = await Promise.all([
        plansService.plansForUserOnDate(req.userId, date.slice(0, 10)),
        plansService.adherenceForDate(req.userId, date.slice(0, 10)),
      ]);
      res.json({ success: true, data: { date: date.slice(0, 10), plans, adherence } });
    } catch (err) {
      next(err);
    }
  }
);

myPlanRouter.get('/report', async (req, res, next) => {
  try {
    res.json({ success: true, data: await plansService.weeklyReport(req.userId, await dateParam(req.query.date, req.userId)) });
  } catch (err) {
    next(err);
  }
});

myPlanRouter.get('/coaches', async (req, res, next) => {
  try {
    res.json({ success: true, data: await coachService.listMyCoaches(req.userId) });
  } catch (err) {
    next(err);
  }
});

myPlanRouter.post(
  '/accept-invite',
  validate(Joi.object({ code: Joi.string().trim().min(4).max(32).required() })),
  async (req, res, next) => {
    try {
      const data = await coachService.acceptInvite(req.userId, req.body.code);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

myPlanRouter.delete('/coaches/:id', async (req, res, next) => {
  try {
    await coachService.leaveCoach(req.userId, req.params.id);
    res.json({ success: true, data: { left: true } });
  } catch (err) {
    next(err);
  }
});
