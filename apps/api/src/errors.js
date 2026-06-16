export function sendError(res, status, message, details) {
  return res.status(status).json({
    error: message,
    ...(details ? { details } : {})
  });
}

export function isDuplicateKey(error) {
  return error && error.code === 11000;
}
