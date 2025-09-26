export interface RPServerHooks {
  playerConnecting: (ipAddress: string) => boolean | Promise<boolean>;
}
