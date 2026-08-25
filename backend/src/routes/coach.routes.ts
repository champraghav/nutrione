import '../types';
import { Router } from 'express';
import Joi from 'joi';
import * as coachService from '../services/coach.service';
import * as plansService from '../services/plans.service';
import * as habitsService from '../services/habits.service';
import * as messagesService from '../services/messages.service';
import { query } from '../config/database';
import { requireAuth } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { shiftYmd } from '../services/habits.calc';

export const coachRouter = Router();

coachRouter.use(requireAuth);

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function dateParam(value: unknown): string {
  return typeof value === 'string' && value.length >= 10 ? value.slice(0, 10) : today();
}

// --- Roster -----------------------------------------------------------------

coachRouter.get('/clients', async (req, res, next) => {
  try {
    const data = await coachService.clientOverview(req.userId, dateParam(req.query.date));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

const addClientSchema = Joi.object({
  name: Joi.string().trim().min(1).max(120).required(),
  email: Joi.string().email().allow('', null),
  notes: Joi.string().max(2000).allow('', null),
});

coachRouter.post('/clients', validate(addClientSchema), async (req, res, next) => {
  try {
    const data = await coachService.addClient(req.userId, req.body);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

coachRouter.put('/clients/:id/notes', validate(Joi.object({ notes: Joi.string().max(2000).allow('') })), async (req, res, next) => {
  try {
    await coachService.updateClientNotes(req.userId, req.params.id, req.body.notes ?? '');
    res.json({ success: true, data: { saved: true } });
  } catch (err) {
    next(err);
  }
});

coachRouter.delete('/clients/:id', async (req, res, next) => {
  try {
    await coachService.endClient(req.userId, req.params.id);
    res.json({ success: true, data: { ended: true } });
  } catch (err) {
    next(err);
  }
});

/**
 * Everything a coach needs on one client, in one request: who they are, what
 * they are meant to be doing, what they actually did, and the trend.
 */
coachRouter.get('/clients/:id', async (req, res, next) => {
  try {
    const link = await coachService.requireClientAccess(req.userId, req.params.id);
    const date = dateParam(req.query.date);
    const clientId = link.client_user_id as string;

    const last14 = Array.from({ length: 14 }, (_, i) => shiftYmd(date, -(13 - i)));

    const [assignments, dayPlans, adherence, trend, habits, weights, nutrition] = await Promise.all([
      plansService.listAssignments(req.userId, req.params.id),
      plansService.plansForUserOnDate(clientId, date),
      plansService.adherenceForDate(clientId, date),
      plansService.adherenceTrend(clientId, last14),
      habitsService.getHabitsSummary(clientId, date),
      query(
        `SELECT recorded_at::date::text AS date, value FROM health_metrics
         WHERE user_id = $1 AND metric_type = 'weight'
         ORDER BY recorded_at DESC LIMIT 30`,
        [clientId]
      ),
      query(
        `SELECT log_date::text AS date, total_calories, total_protein_g, total_carbs_g, total_fat_g
         FROM nutrition_logs WHERE user_id = $1 AND log_date >= $2 ORDER BY log_date ASC`,
        [clientId, shiftYmd(date, -29)]
      ),
    ]);

    res.json({
      success: true,
      data: {
        client: {
          id: link.id,
          name: link.client_name,
          email: link.client_email,
          status: link.status,
          notes: link.notes,
          accepted_at: link.accepted_at,
        },
        date,
        assignments,
        dayPlans,
        adherence,
        trend,
        habits,
        weights,
        nutrition,
      },
    });
  } catch (err) {
    next(err);
  }
});

// --- Plans ------------------------------------------------------------------

coachRouter.get('/plans', async (req, res, next) => {
  try {
    const kind = typeof req.query.kind === 'string' ? req.query.kind : undefined;
    res.json({ success: true, data: await plansService.listPlans(req.userId, kind) });
  } catch (err) {
    next(err);
  }
});

coachRouter.get('/plans/:id', async (req, res, next) => {
  try {
    res.json({ success: true, data: await plansService.getPlan(req.userId, req.params.id) });
  } catch (err) {
    next(err);
  }
});

const planSchema = Joi.object({
  name: Joi.string().trim().min(1).max(120).required(),
  description: Joi.string().max(2000).allow('', null),
  kind: Joi.string().valid('diet', 'training').required(),
  cycleDays: Joi.number().integer().min(1).max(28),
});

coachRouter.post('/plans', validate(planSchema), async (req, res, next) => {
  try {
    res.status(201).json({ success: true, data: await plansService.createPlan(req.userId, req.body) });
  } catch (err) {
    next(err);
  }
});

coachRouter.put(
  '/plans/:id',
  validate(planSchema.fork(['kind'], (s) => s.optional())),
  async (req, res, next) => {
    try {
      await plansService.updatePlan(req.userId, req.params.id, req.body);
      res.json({ success: true, data: await plansService.getPlan(req.userId, req.params.id) });
    } catch (err) {
      next(err);
    }
  }
);

coachRouter.delete('/plans/:id', async (req, res, next) => {
  try {
    await plansService.archivePlan(req.userId, req.params.id);
    res.json({ success: true, data: { archived: true } });
  } catch (err) {
    next(err);
  }
});

const planItemSchema = Joi.object({
  dayNumber: Joi.number().integer().min(1).max(28).required(),
  mealType: Joi.string().valid('breakfast', 'lunch', 'dinner', 'snack').allow(null),
  foodId: Joi.string().uuid().allow(null),
  customName: Joi.string().max(160).allow('', null),
  quantity: Joi.number().min(0).allow(null),
  unit: Joi.string().max(20).allow('', null),
  exerciseId: Joi.string().uuid().allow(null),
  sets: Joi.number().integer().min(1).max(50).allow(null),
  reps: Joi.number().integer().min(1).max(500).allow(null),
  durationMinutes: Joi.number().integer().min(1).max(600).allow(null),
  notes: Joi.string().max(500).allow('', null),
});

coachRouter.post('/plans/:id/items', validate(planItemSchema), async (req, res, next) => {
  try {
    res.status(201).json({ success: true, data: await plansService.addPlanItem(req.userId, req.params.id, req.body) });
  } catch (err) {
    next(err);
  }
});

coachRouter.delete('/plans/:id/items/:itemId', async (req, res, next) => {
  try {
    res.json({ success: true, data: await plansService.deletePlanItem(req.userId, req.params.id, req.params.itemId) });
  } catch (err) {
    next(err);
  }
});

coachRouter.post(
  '/plans/:id/copy-day',
  validate(Joi.object({ fromDay: Joi.number().integer().min(1).required(), toDay: Joi.number().integer().min(1).required() })),
  async (req, res, next) => {
    try {
      const { fromDay, toDay } = req.body;
      res.json({ success: true, data: await plansService.copyPlanDay(req.userId, req.params.id, fromDay, toDay) });
    } catch (err) {
      next(err);
    }
  }
);

// --- Assignments ------------------------------------------------------------

const assignSchema = Joi.object({
  planId: Joi.string().uuid().required(),
  coachClientId: Joi.string().uuid().required(),
  startDate: Joi.string().min(10).required(),
  endDate: Joi.string().min(10).allow(null, ''),
});

coachRouter.post('/assignments', validate(assignSchema), async (req, res, next) => {
  try {
    const body = req.body as { planId: string; coachClientId: string; startDate: string; endDate?: string };
    const data = await plansService.assignPlan(req.userId, {
      planId: body.planId,
      coachClientId: body.coachClientId,
      startDate: body.startDate.slice(0, 10),
      endDate: body.endDate ? body.endDate.slice(0, 10) : null,
    });
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

coachRouter.delete('/assignments/:id', async (req, res, next) => {
  try {
    await plansService.endAssignment(req.userId, req.params.id);
    res.json({ success: true, data: { ended: true } });
  } catch (err) {
    next(err);
  }
});


// --- Messages ---------------------------------------------------------------
//
// Mounted on the coach router but usable by either side: access is resolved
// from the coaching link, so a client hitting these with their own token gets
// their own conversation and nothing else.

coachRouter.get('/unread', async (req, res, next) => {
  try {
    res.json({ success: true, data: await messagesService.unreadCounts(req.userId) });
  } catch (err) {
    next(err);
  }
});

coachRouter.get('/clients/:id/report', async (req, res, next) => {
  try {
    const link = await coachService.requireClientAccess(req.userId, req.params.id);
    const data = await plansService.weeklyReport(link.client_user_id as string, dateParam(req.query.date));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

coachRouter.get('/clients/:id/messages', async (req, res, next) => {
  try {
    res.json({ success: true, data: await messagesService.listMessages(req.userId, req.params.id) });
  } catch (err) {
    next(err);
  }
});

coachRouter.post(
  '/clients/:id/messages',
  validate(Joi.object({ body: Joi.string().trim().min(1).max(4000).required() })),
  async (req, res, next) => {
    try {
      const data = await messagesService.sendMessage(req.userId, req.params.id, req.body.body);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);
