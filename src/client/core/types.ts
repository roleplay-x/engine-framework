import { RPHookBus } from '../../core/bus/hook-bus';
import { ClientPlatformAdapter } from '../natives/adapters';

import { RPClientHooks } from './hooks/hooks';

/** Base client types interface */
export interface ClientTypes {
  hooks: RPClientHooks;
  platformAdapter: ClientPlatformAdapter;
}

/** Custom client context options interface */
export interface CustomClientContextOptions {
  /** Client identifier */
  clientId?: string;
}

/** Service context interface for dependency injection */
export interface IServiceContext<T extends { hooks: any; options: any }> {
  hookBus: RPHookBus<T['hooks']>;
  customOptions: T['options'];
}
