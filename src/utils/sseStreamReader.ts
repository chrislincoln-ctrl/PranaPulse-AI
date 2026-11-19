/**
 * Reads a UTF-8 `ReadableStream<Uint8Array>` line-by-line, flushing any trailing
 * buffered chunk after EOF so final SSE events are never truncated.
 */
export async function readStreamLines(
  body: ReadableStream<Uint8Array>,
  onLine: (line: string) => void,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      onLine(line);
    }
  }

  const trailing = `${buffer}${decoder.decode()}`;
  if (trailing.trim().length > 0) {
    for (const line of trailing.split('\n')) {
      onLine(line);
    }
  }
}

