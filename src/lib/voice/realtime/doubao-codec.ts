import { gunzipSync, gzipSync } from 'node:zlib';
import {
  DOUBAO_PROTOCOL_HEADER_BYTES,
  DOUBAO_PROTOCOL_HEADER_WORDS,
  DOUBAO_PROTOCOL_VERSION,
  DOUBAO_REALTIME_EVENT_NAMES,
  DoubaoCompression,
  DoubaoDecodedFrame,
  DoubaoEncodeFrameInput,
  DoubaoMessageFlags,
  DoubaoSerialization,
} from './doubao-protocol-types';

function encodeHeader(input: Required<Pick<DoubaoEncodeFrameInput, 'messageType' | 'flags' | 'serialization' | 'compression'>>): Buffer {
  return Buffer.from([
    (DOUBAO_PROTOCOL_VERSION << 4) | DOUBAO_PROTOCOL_HEADER_WORDS,
    (input.messageType << 4) | input.flags,
    (input.serialization << 4) | input.compression,
    0,
  ]);
}

function encodeInt32(value: number): Buffer {
  const buffer = Buffer.alloc(4);
  buffer.writeInt32BE(value, 0);
  return buffer;
}

function maybeCompress(payload: Buffer, compression: DoubaoCompression): Buffer {
  if (!payload.length || compression === DoubaoCompression.None) return payload;
  if (compression === DoubaoCompression.Gzip) return gzipSync(payload);
  throw new Error(`Unsupported Doubao payload compression: ${compression}`);
}

function maybeDecompress(payload: Buffer, compression: number): Buffer {
  if (!payload.length || compression === DoubaoCompression.None) return payload;
  if (compression === DoubaoCompression.Gzip) return gunzipSync(payload);
  return payload;
}

function toPayload(input: DoubaoEncodeFrameInput): Buffer {
  if (input.payloadJson !== undefined) {
    return Buffer.from(JSON.stringify(input.payloadJson), 'utf8');
  }
  return input.payload || Buffer.alloc(0);
}

function isLikelySessionId(buffer: Buffer): boolean {
  if (!buffer.length || buffer.length > 512) return false;
  return buffer.every(byte => byte >= 0x20 && byte <= 0x7e);
}

function tryReadSessionId(frame: Buffer, offset: number): { sessionId?: string; nextOffset: number } {
  if (frame.length - offset < 8) return { nextOffset: offset };
  const length = frame.readInt32BE(offset);
  const sessionStart = offset + 4;
  const sessionEnd = sessionStart + length;
  if (length <= 0 || sessionEnd > frame.length || frame.length - sessionEnd < 4) {
    return { nextOffset: offset };
  }

  const sessionBytes = frame.subarray(sessionStart, sessionEnd);
  if (!isLikelySessionId(sessionBytes)) return { nextOffset: offset };
  return { sessionId: sessionBytes.toString('utf8'), nextOffset: sessionEnd };
}

function readPayload(frame: Buffer, offset: number): { payloadSize?: number; payload: Buffer } {
  if (frame.length - offset < 4) {
    return { payload: frame.subarray(offset) };
  }

  const payloadSize = frame.readInt32BE(offset);
  const payloadStart = offset + 4;
  const payloadEnd = payloadStart + payloadSize;
  if (payloadSize >= 0 && payloadEnd <= frame.length) {
    return {
      payloadSize,
      payload: frame.subarray(payloadStart, payloadEnd),
    };
  }

  return { payload: frame.subarray(offset) };
}

function parseJsonPayload(payload: Buffer, serialization: number): unknown | undefined {
  if (!payload.length || serialization !== DoubaoSerialization.Json) return undefined;
  const text = payload.toString('utf8').trim();
  if (!text) return undefined;
  return JSON.parse(text);
}

export function encodeDoubaoFrame(input: DoubaoEncodeFrameInput): Buffer {
  const flags = input.flags ?? (
    input.eventId === undefined ? DoubaoMessageFlags.None : DoubaoMessageFlags.WithEvent
  );
  const serialization = input.serialization ?? (
    input.payloadJson === undefined ? DoubaoSerialization.None : DoubaoSerialization.Json
  );
  const compression = input.compression ?? DoubaoCompression.Gzip;
  const payload = maybeCompress(toPayload(input), compression);

  const parts: Buffer[] = [
    encodeHeader({
      messageType: input.messageType,
      flags,
      serialization,
      compression,
    }),
  ];

  if (input.eventId !== undefined) {
    parts.push(encodeInt32(input.eventId));
  }

  if (input.sessionId !== undefined) {
    const sessionBytes = Buffer.from(input.sessionId, 'utf8');
    parts.push(encodeInt32(sessionBytes.length), sessionBytes);
  }

  if (input.includePayloadSize !== false) {
    parts.push(encodeInt32(payload.length));
  }
  parts.push(payload);

  return Buffer.concat(parts);
}

export function decodeDoubaoFrame(frame: Buffer): DoubaoDecodedFrame {
  if (frame.length < DOUBAO_PROTOCOL_HEADER_BYTES) {
    throw new Error(`Doubao frame too short: ${frame.length}`);
  }

  const protocolVersion = frame[0] >> 4;
  const headerSizeWords = frame[0] & 0x0f;
  const headerBytes = headerSizeWords * 4;
  if (protocolVersion !== DOUBAO_PROTOCOL_VERSION) {
    throw new Error(`Unsupported Doubao protocol version: ${protocolVersion}`);
  }
  if (headerBytes < DOUBAO_PROTOCOL_HEADER_BYTES || frame.length < headerBytes) {
    throw new Error(`Invalid Doubao header size: ${headerSizeWords}`);
  }

  const header = {
    protocolVersion,
    headerSizeWords,
    messageType: frame[1] >> 4,
    flags: frame[1] & 0x0f,
    serialization: frame[2] >> 4,
    compression: frame[2] & 0x0f,
    reserved: frame[3],
  };

  let offset = headerBytes;
  let eventId: number | undefined;
  if ((header.flags & DoubaoMessageFlags.WithEvent) !== 0 && frame.length - offset >= 4) {
    eventId = frame.readInt32BE(offset);
    offset += 4;
  }

  const sessionResult = tryReadSessionId(frame, offset);
  offset = sessionResult.nextOffset;
  const payloadResult = readPayload(frame, offset);
  const payload = maybeDecompress(payloadResult.payload, header.compression);
  const eventName = eventId === undefined ? undefined : (DOUBAO_REALTIME_EVENT_NAMES[eventId] || 'Unknown');

  return {
    header,
    eventId,
    eventName,
    sessionId: sessionResult.sessionId,
    payloadSize: payloadResult.payloadSize,
    payload,
    payloadJson: parseJsonPayload(payload, header.serialization),
  };
}
