import Emittery from 'emittery';

export type FilterObject<P> = Partial<{
  [K in keyof P]: P[K] | ((v: P[K], payload: P) => boolean);
}> & { custom?: (payload: P) => boolean };

function buildPredicate<P>(f: FilterObject<P>) {
  return (payload: P): boolean => {
    for (const k of Object.keys(f) as (keyof FilterObject<P>)[]) {
      const c = f[k]!;
      if (k === 'custom') {
        if (!(c as (payload: P) => boolean)(payload)) return false;
      } else {
        const v = (payload as Record<string, unknown>)[k as string];
        if (typeof c === 'function') {
          if (!(c as (v: unknown, payload: P) => boolean)(v, payload)) return false;
        } else if (v !== c) {
          return false;
        }
      }
    }
    return true;
  };
}

export class RPHookBus<HM extends object> {
  private core = new Emittery<{
    [K in Extract<keyof HM, string>]: HM[K] extends (arg: infer P) => unknown ? P : never;
  }>();
  private wrappers = new Map<string, Map<unknown, (payload: unknown) => Promise<unknown>>>();

  on<K extends Extract<keyof HM, string>>(
    name: K,
    fn: HM[K],
    filter?: HM[K] extends (arg: infer P) => unknown
      ? FilterObject<P> | ((p: P) => boolean)
      : never,
  ) {
    const predicate = !filter
      ? () => true
      : typeof filter === 'function'
        ? (filter as (p: unknown) => boolean)
        : buildPredicate(filter as FilterObject<unknown>);

    const wrapper = async (payload: unknown) => {
      if (!predicate(payload)) return payload;
      const ret = await (fn as (arg: unknown) => unknown)(payload);
      return ret === undefined ? payload : ret;
    };

    let m = this.wrappers.get(name);
    if (!m) {
      m = new Map();
      this.wrappers.set(name, m);
    }
    m.set(fn, wrapper);
    this.core.on(name, wrapper as (eventData: unknown) => void | Promise<void>);
  }

  off<K extends Extract<keyof HM, string>>(name: K, fn?: (...args: unknown[]) => unknown) {
    if (!fn) {
      this.core.clearListeners(name);
      this.wrappers.delete(name);
      return;
    }
    const m = this.wrappers.get(name);
    const wrapper = m?.get(fn);
    if (wrapper) {
      this.core.off(name, wrapper as (eventData: unknown) => void | Promise<void>);
      m!.delete(fn);
    }
  }

  async run<K extends Extract<keyof HM, string>>(
    name: K,
    initial: HM[K] extends (arg: infer P) => unknown ? P : never,
  ): Promise<unknown> {
    const m = this.wrappers.get(name);
    let payload: unknown = initial;
    if (m) {
      for (const wrapper of m.values()) {
        payload = await wrapper(payload);
      }
    }
    return payload;
  }
}
