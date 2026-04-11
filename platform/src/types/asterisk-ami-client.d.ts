declare module 'asterisk-ami-client' {
  import type { EventEmitter } from 'events';

  export interface AmiClientOptions {
    reconnect?: boolean;
    maxAttemptsCount?: number;
    attemptsDelay?: number;
    keepAlive?: boolean;
    keepAliveDelay?: number;
    emitEventsByTypes?: boolean;
    eventTypeToLowerCase?: boolean;
    emitResponsesById?: boolean;
  }

  export default class AmiClient extends EventEmitter {
    constructor(options?: AmiClientOptions);
    connect(user: string, secret: string, options?: { host?: string; port?: number }): Promise<unknown>;
    on(event: 'connect' | 'disconnect' | 'event' | 'Dial' | 'Hangup' | string, listener: (...args: unknown[]) => void): this;
  }
}
