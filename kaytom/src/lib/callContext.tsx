import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { CallManager, type CallState } from './calls';

const IDLE_STATE = { phase: 'idle' } as CallState;
const Ctx = createContext<{ mgr: CallManager | null; state: CallState }>({ mgr: null, state: IDLE_STATE });

export function CallProvider({ me, children }: { me: string; children: ReactNode }) {
  const mgr = useMemo(() => new CallManager(me), [me]);
  useEffect(() => { mgr.start(); return () => mgr.destroy(); }, [mgr]);
  const state = useSyncExternalStore(mgr.subscribe, mgr.getState);
  return <Ctx.Provider value={{ mgr, state }}>{children}</Ctx.Provider>;
}
export const useCall = () => useContext(Ctx);
