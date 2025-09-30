export interface ICoreAdapter {
  getMaxPlayers(): number;
  getPlayerCount(): number;
  getResourceName(): string;
  log(message: string): void;
}
