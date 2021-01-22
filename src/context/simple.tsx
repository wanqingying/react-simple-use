import React, { FC, createContext, useContext, useRef, useState } from 'react';
import { EventEmitter } from '../hooks/useEventEmitter';

enum EventName {
  onChange = 'onChange',
}
interface SimpleStateEvent {
  type: string;
  keys: string[];
  data: any;
  state: any;
}

type Updater<T> = (state: T) => void;
interface UseRet<T> {
  state: T;
  update: (updater: Updater<T>) => void;
}

export class SimpleState<T> {
  private state: T;
  public readKeys: string[] = [];
  private proxyReadState = new Proxy(this.state as any, {
    get(target: T, p: PropertyKey): any {
      return (target as any)[p];
    },
    set(): boolean {
      return true;
    },
  });
  constructor(iniState: T) {
    this.state = iniState;
  }
  public event: EventEmitter<SimpleStateEvent> = new EventEmitter();
  public update = (updater: Updater<T>) => {
    const preState: any = { ...this.state };
    updater(this.state);
    const nextState: any = this.state;
    const keys: string[] = [];
    for (const k of nextState as any) {
      if (preState[k] !== nextState[k]) {
        keys.push(k);
      }
    }
    if (keys.length > 0) {
      this.event.emit(EventName.onChange, {
        data: null,
        state: this.getReadState(),
        type: 'onChange',
        keys: keys,
      });
    }
  };
  public getReadState = () => {
    return this.proxyReadState as T;
  };
}

export function getSimpleContext<S>(iniState?: S) {
  const Context = createContext<SimpleState<S>>({} as any);
  const Provider: FC<{ iniState: any }> = function (props) {
    const state = useRef(
      new SimpleState<S>({ ...(props.iniState || {}), ...(iniState || {}) }),
    );
    return (
      <Context.Provider value={state.current}>
        {props.children}
      </Context.Provider>
    );
  };
  const useSimpleContext: UseCtxKeys<S> & UseCtxCb<S> = (
    subKeys: any[] | Function,
  ) => {
    const ctx = useContext(Context);
    const [state, setState] = useState<S>(ctx.getReadState());
    ctx.event.useSubscription(
      EventName.onChange,
      function ({ keys, state: nextState }) {
        if (Array.isArray(subKeys)) {
          if (subKeys.find((k) => keys.includes(k))) {
            setState(nextState);
          }
        } else {
          const prev: any[] = subKeys(state);
          const next: any[] = subKeys(nextState);

          if (prev.find((v, idx) => next[idx] !== v)) {
            setState(nextState);
          }
        }
      },
    );
    return { state: ctx.getReadState(), update: ctx.update };
  };
  return { Provider, useSimpleContext };
}

type UseCtxKeys<S> = (subKeys: (keyof S)[]) => UseRet<S>;
type UseCtxCb<S> = (cb: (state: S) => any[]) => UseRet<S>;

