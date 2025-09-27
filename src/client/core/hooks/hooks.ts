import { GameEventName, GameEventArgs } from '../../natives/events/game-events';

/** Event hook data for client events */
export interface ClientEventHookData {
  event: string;
  data: any;
  preventDefault: () => void;
  stopPropagation: () => void;
}

/** Event hook data for server events */
export interface ServerEventHookData {
  event: string;
  data: any;
  preventDefault: () => void;
  stopPropagation: () => void;
}

/** Event hook data for game events */
export interface GameEventHookData<T extends GameEventName = GameEventName> {
  event: T;
  args: GameEventArgs<T>;
  preventDefault: () => void;
  stopPropagation: () => void;
}

/** Client hooks interface */
export interface RPClientHooks {
  /** Hook called before any client event is processed */
  beforeClientEvent?: (data: ClientEventHookData) => void | Promise<void>;
  
  /** Hook called after any client event is processed */
  afterClientEvent?: (data: ClientEventHookData) => void | Promise<void>;
  
  /** Hook called before any server event is processed */
  beforeServerEvent?: (data: ServerEventHookData) => void | Promise<void>;
  
  /** Hook called after any server event is processed */
  afterServerEvent?: (data: ServerEventHookData) => void | Promise<void>;
  
  /** Hook called before any game event is processed */
  beforeGameEvent?: <T extends GameEventName>(data: GameEventHookData<T>) => void | Promise<void>;
  
  /** Hook called after any game event is processed */
  afterGameEvent?: <T extends GameEventName>(data: GameEventHookData<T>) => void | Promise<void>;
  
  /** Hook called before any event is processed (universal) */
  beforeEvent?: (data: ClientEventHookData | ServerEventHookData | GameEventHookData) => void | Promise<void>;
  
  /** Hook called after any event is processed (universal) */
  afterEvent?: (data: ClientEventHookData | ServerEventHookData | GameEventHookData) => void | Promise<void>;
}
