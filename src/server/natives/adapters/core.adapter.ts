export interface ICoreAdapter {
  getMaxPlayers(): number;
  getPlayerCount(): number;
  log(message: string): void;
}
