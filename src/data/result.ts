// The common shape every data function returns: it worked (with a value) or it failed (with a plain message).

export type DataResult<T> = { ok: true; value: T } | { ok: false; message: string };

export function good<T>(value: T): DataResult<T> {
  return { ok: true, value };
}

export function bad<T = never>(message: string): DataResult<T> {
  return { ok: false, message };
}
