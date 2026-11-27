import { app } from "./app";

/** Worker entry: Hono handles HTTP; the Durable Object class must be exported from the entry module. */
export { RealtimeRoom } from "./realtime/room";
export default app;
