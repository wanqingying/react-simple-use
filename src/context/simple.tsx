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
        state: nextState,
        type: 'onChange',
        keys: keys,
      });
    }
  };
  public getState = () => {
    return { ...this.state };
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
  const useSimpleContext: (subKeys: string[]) => UseRet<S> = (subKeys) => {
    const ctx = useContext(Context);
    const [state, setState] = useState<S>(ctx.getState());
    ctx.event.useSubscription(EventName.onChange, function ({ keys, state }) {
      if (subKeys.find((k) => keys.includes(k))) {
        setState(state);
      }
    });
    return { state: state, update: ctx.update };
  };
  return { Provider, useSimpleContext };
}
