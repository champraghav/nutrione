import { Router } from 'express';
import Joi from 'joi';
import * as authService from '../services/auth.service';
import { validate } from '../middleware/validate.middleware';

export const authRouter = Router();

const signupSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(72).required(),
  firstName: Joi.string().max(100),
  lastName: Joi.string().max(100),
});

authRouter.post('/signup', validate(signupSchema), async (req, res, next) => {
  try {
    const { email, password, firstName, lastName } = req.body;
    const { user, tokens } = await authService.signup(email, password, firstName, lastName);
    res.status(201).json({ success: true, data: { user, ...tokens } });
  } catch (err) {
    next(err);
  }
});

const signinSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

authRouter.post('/signin', validate(signinSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const { user, tokens } = await authService.signin(email, password);
    res.json({ success: true, data: { user, ...tokens } });
  } catch (err) {
    next(err);
  }
});

const refreshSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

authRouter.post('/refresh', validate(refreshSchema), async (req, res, next) => {
  try {
    const tokens = await authService.refresh(req.body.refreshToken);
    res.json({ success: true, data: tokens });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/logout', validate(refreshSchema), async (req, res, next) => {
  try {
    await authService.logout(req.body.refreshToken);
    res.json({ success: true, data: { loggedOut: true } });
  } catch (err) {
    next(err);
  }
});
