/** Message pushed to every socket subscribed to a topic (topic = resource name, or a custom string). */
export interface RealtimeEvent<T = unknown> {
  type: "created" | "updated" | "deleted" | (string & {});
  topic: string;
  id?: number;
  data?: T;
  /** User id that caused the event, so a client can ignore its own echoes if it wants. */
  by?: number;
  at: string;
}

export interface RealtimeTicket {
  ticket: string;
  url: string;
  expiresIn: number;
}

export const TOPIC_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;
