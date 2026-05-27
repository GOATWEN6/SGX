export const DOUBAO_PROTOCOL_VERSION = 1;
export const DOUBAO_PROTOCOL_HEADER_WORDS = 1;
export const DOUBAO_PROTOCOL_HEADER_BYTES = DOUBAO_PROTOCOL_HEADER_WORDS * 4;
export const DOUBAO_WS_BINARY_OPCODE = 0x2;

export enum DoubaoMessageType {
  FullClientRequest = 0x1,
  AudioOnlyClientRequest = 0x2,
  FullServerResponse = 0x9,
  ServerAck = 0xb,
  Error = 0xf,
}

export enum DoubaoMessageFlags {
  None = 0x0,
  PositiveSequence = 0x1,
  NegativeSequence = 0x2,
  WithEvent = 0x4,
}

export enum DoubaoSerialization {
  None = 0x0,
  Json = 0x1,
}

export enum DoubaoCompression {
  None = 0x0,
  Gzip = 0x1,
}

export const DOUBAO_REALTIME_EVENTS = {
  StartConnection: 1,
  FinishConnection: 2,
  ConnectionStarted: 50,
  ConnectionFailed: 51,
  ConnectionFinished: 52,
  StartSession: 100,
  FinishSession: 102,
  SessionStarted: 150,
  SessionFailed: 151,
  SessionFinished: 152,
  TaskRequest: 200,
  TTSSegmentStart: 350,
  TTSSegmentEnd: 351,
  TTSFinished: 352,
  ChatResponse: 450,
  ChatEnded: 451,
  ClientInterrupt: 500,
  ServerInterrupted: 550,
} as const;

export type DoubaoRealtimeEventName = keyof typeof DOUBAO_REALTIME_EVENTS;
export type DoubaoRealtimeEventId = typeof DOUBAO_REALTIME_EVENTS[DoubaoRealtimeEventName];

export const DOUBAO_REALTIME_EVENT_NAMES: Record<number, DoubaoRealtimeEventName | 'Unknown'> =
  Object.fromEntries(
    Object.entries(DOUBAO_REALTIME_EVENTS).map(([name, id]) => [id, name])
  ) as Record<number, DoubaoRealtimeEventName | 'Unknown'>;

export const DOUBAO_COMPLETION_EVENT_IDS = new Set<number>([
  DOUBAO_REALTIME_EVENTS.ConnectionFinished,
  DOUBAO_REALTIME_EVENTS.SessionFinished,
  DOUBAO_REALTIME_EVENTS.TTSSegmentEnd,
  DOUBAO_REALTIME_EVENTS.TTSFinished,
  DOUBAO_REALTIME_EVENTS.ChatEnded,
]);

export const DOUBAO_ERROR_EVENT_IDS = new Set<number>([
  DOUBAO_REALTIME_EVENTS.ConnectionFailed,
  DOUBAO_REALTIME_EVENTS.SessionFailed,
]);

export interface DoubaoFrameHeader {
  protocolVersion: number;
  headerSizeWords: number;
  messageType: DoubaoMessageType | number;
  flags: DoubaoMessageFlags | number;
  serialization: DoubaoSerialization | number;
  compression: DoubaoCompression | number;
  reserved: number;
}

export interface DoubaoDecodedFrame {
  header: DoubaoFrameHeader;
  eventId?: number;
  eventName?: DoubaoRealtimeEventName | 'Unknown';
  sessionId?: string;
  payloadSize?: number;
  payload: Buffer;
  payloadJson?: unknown;
}

export interface DoubaoEncodeFrameInput {
  messageType: DoubaoMessageType;
  flags?: DoubaoMessageFlags;
  serialization?: DoubaoSerialization;
  compression?: DoubaoCompression;
  eventId?: number;
  sessionId?: string;
  payload?: Buffer;
  payloadJson?: unknown;
  includePayloadSize?: boolean;
}
