'use strict';

// Error de negocio con estado HTTP y cuerpo uniforme { error: { code, message, field? } }.
class HttpError extends Error {
  constructor(status, code, message, field) {
    super(message);
    this.status = status;
    this.code = code;
    this.field = field;
  }
}

const unauthorized = () => new HttpError(401, 'NO_AUTENTICADO', 'Debe iniciar sesión');
const forbidden = (msg = 'Su rol no permite esta operación') => new HttpError(403, 'PROHIBIDO', msg);
const notFound = (msg = 'Recurso no encontrado') => new HttpError(404, 'NO_ENCONTRADO', msg);
const conflict = (code, msg) => new HttpError(409, code, msg);
const invalid = (field, msg) => new HttpError(422, 'VALIDACION', msg, field);

module.exports = { HttpError, unauthorized, forbidden, notFound, conflict, invalid };
