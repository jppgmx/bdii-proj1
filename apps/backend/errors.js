export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function notFound(_req, _res, next) {
  next(new ApiError(404, 'NOT_FOUND', 'Recurso não encontrado.'));
}

export function errorHandler(logger) {
  return (error, _req, res, next) => {
    if (res.headersSent) return next(error);

    if (error.type === 'entity.parse.failed') {
      error = new ApiError(400, 'INVALID_JSON', 'O corpo deve conter JSON válido.');
    } else if (error.type === 'entity.too.large') {
      error = new ApiError(413, 'PAYLOAD_TOO_LARGE', 'O corpo excede o limite de 100 KB.');
    }

    if (!(error instanceof ApiError)) {
      // Não registrar mensagens que possam carregar SQL, URLs ou credenciais.
      logger.error(`Falha interna na requisição (${error.name ?? 'Error'}).`);
      error = new ApiError(500, 'INTERNAL_ERROR', 'Não foi possível concluir a operação.');
    }

    res.status(error.status).json({
      error: { code: error.code, message: error.message },
    });
  };
}
