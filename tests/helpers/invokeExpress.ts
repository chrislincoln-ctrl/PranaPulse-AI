import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import { type Express } from 'express';

export interface InvokeRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
  rawBody?: string;
}

export interface InvokeResponse {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  text: string;
  body: unknown;
}

function buildPayloadBuffer(options: InvokeRequestOptions): Buffer | undefined {
  if (typeof options.rawBody === 'string') {
    return Buffer.from(options.rawBody, 'utf8');
  }
  if (options.body !== undefined) {
    return Buffer.from(JSON.stringify(options.body), 'utf8');
  }
  return undefined;
}

function toSafeBuffer(chunk: unknown, encoding?: BufferEncoding): Buffer | undefined {
  if (typeof chunk === 'string') {
    return Buffer.from(chunk, encoding ?? 'utf8');
  }
  if (Buffer.isBuffer(chunk)) {
    return chunk;
  }
  if (ArrayBuffer.isView(chunk)) {
    return Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength);
  }
  return undefined;
}

function normalizeRequestHeaders(
  headers: Record<string, string> | undefined,
  payload: Buffer | undefined,
): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [key, val] of Object.entries(headers ?? {})) {
    normalized[key.toLowerCase()] = val;
  }
  if (payload !== undefined) {
    normalized['content-type'] ??= 'application/json';
    normalized['content-length'] = String(payload.byteLength);
  }
  return normalized;
}

function buildResult(res: ServerResponse, chunks: readonly Buffer[]): InvokeResponse {
  const headerMap: Record<string, string | string[] | undefined> = {};
  for (const [key, val] of Object.entries(res.getHeaders())) {
    headerMap[key] = typeof val === 'number' ? String(val) : val;
  }
  const rawText = Buffer.concat(chunks).toString('utf8');
  let parsedBody: unknown = rawText;
  try {
    parsedBody = rawText.length > 0 ? JSON.parse(rawText) : {};
  } catch {
    // Preserve raw HTML, plain text, or SSE frames when not single JSON document.
  }
  return {
    status: res.statusCode,
    headers: headerMap,
    text: rawText,
    body: parsedBody,
  };
}

/**
 * Invokes an Express 5 application completely in-memory using Node HTTP request/response streams
 * with zero TCP socket binding, capturing Helmet headers, JSON payloads, static HTML, and SSE streams.
 *
 * @param app - Configured Express 5 application instance.
 * @param options - Simulated HTTP request parameters.
 * @returns Captured status code, headers, decoded body text, and parsed JSON payload.
 */
export async function invokeExpress(
  app: Express,
  options: InvokeRequestOptions,
): Promise<InvokeResponse> {
  const socket = new Socket();
  Object.defineProperty(socket, 'remoteAddress', { value: '127.0.0.1', configurable: true });
  Object.defineProperty(socket, 'writable', { value: true, configurable: true });
  socket.write = (
    _chunk: unknown,
    encodingOrCb?: BufferEncoding | ((err?: Error | null) => void),
    cb?: (err?: Error | null) => void,
  ): boolean => {
    const callback = typeof encodingOrCb === 'function' ? encodingOrCb : cb;
    if (callback) {
      queueMicrotask(() => {
        callback(null);
      });
    }
    return true;
  };

  const req = new IncomingMessage(socket);
  const res = new ServerResponse(req);
  const payload = buildPayloadBuffer(options);

  req.method = options.method ?? 'GET';
  req.url = options.url;
  req.headers = normalizeRequestHeaders(options.headers, payload);
  res.assignSocket(socket);

  const chunks: Buffer[] = [];
  const origWrite = res.write.bind(res);
  const origEnd = res.end.bind(res);

  res.write = ((
    chunk: unknown,
    encodingOrCb?: BufferEncoding | ((error?: Error | null) => void),
    cb?: (error?: Error | null) => void,
  ): boolean => {
    const captured = toSafeBuffer(
      chunk,
      typeof encodingOrCb === 'string' ? encodingOrCb : undefined,
    );
    if (captured) {
      chunks.push(captured);
    }
    if (typeof encodingOrCb === 'function') {
      return origWrite(chunk, encodingOrCb);
    }
    if (typeof encodingOrCb === 'string') {
      return origWrite(chunk, encodingOrCb, cb);
    }
    return origWrite(chunk);
  }) as typeof res.write;

  return await new Promise<InvokeResponse>((resolve, reject) => {
    res.end = ((
      chunk?: unknown,
      encodingOrCb?: BufferEncoding | (() => void),
      cb?: () => void,
    ): ServerResponse => {
      if (typeof chunk !== 'function') {
        const captured = toSafeBuffer(
          chunk,
          typeof encodingOrCb === 'string' ? encodingOrCb : undefined,
        );
        if (captured) {
          chunks.push(captured);
        }
      }
      let out: ServerResponse;
      if (typeof chunk === 'function') {
        out = origEnd(chunk);
      } else if (typeof encodingOrCb === 'function') {
        out = origEnd(chunk, encodingOrCb);
      } else if (typeof encodingOrCb === 'string') {
        out = origEnd(chunk, encodingOrCb, cb);
      } else {
        out = origEnd(chunk);
      }
      resolve(buildResult(res, chunks));
      return out;
    }) as typeof res.end;

    res.on('error', reject);
    app(req, res);

    queueMicrotask(() => {
      if (payload !== undefined) {
        req.push(payload);
      }
      req.push(null);
    });
  });
}
