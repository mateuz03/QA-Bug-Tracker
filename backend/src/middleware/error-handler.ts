import type { ErrorRequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import multer from 'multer';
import { ZodError } from 'zod';
import { HttpError } from '../utils/http-error.js';

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof multer.MulterError) {
    res.status(400).json({
      message: error.code === 'LIMIT_FILE_SIZE'
        ? 'O arquivo deve possuir no máximo 10 MB.'
        : 'Não foi possível receber o arquivo.'
    });
    return;
  }

  if (error instanceof HttpError) {
    res.status(error.status).json({ message: error.message, details: error.details });
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json({
      message: 'Revise os campos informados.',
      details: error.flatten()
    });
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      res.status(409).json({ message: 'Já existe um registro com estes dados.' });
      return;
    }
    if (error.code === 'P2025') {
      res.status(404).json({ message: 'Registro não encontrado.' });
      return;
    }
  }

  console.error(error);
  res.status(500).json({ message: 'Não foi possível concluir a operação.' });
};
