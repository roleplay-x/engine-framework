export interface RPServerEventEmitterError {
  error: Error;
  event: string;
  payload: unknown;
}
