import { NextFunction, Request, Response } from 'express';
import { ObjectSchema } from 'joi';

type Source = 'body' | 'query' | 'params';

export function validate(schema: ObjectSchema, source: Source = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req[source], { abortEarly: false, stripUnknown: true });
    if (error) {
      next(error);
      return;
    }
    req[source] = value;
    next();
  };
}
