import React from 'react';

type Subscription<T> = (val: T) => void;

export class EventEmitter<T> {
  private subs = new Map<string, Set<Subscription<T>>>();

  emit = (event: string, val: T) => {
    const subs = this.subs.get(event);
    if (subs) {
      for (const subscription of subs) {
        subscription(val);
      }
    }
  };

  useSubscription = (event: string, cb: Subscription<T>) => {
    let subs = this.subs.get(event) as Set<Subscription<T>>;
    if (!subs) {
      subs = new Set<Subscription<T>>();
      this.subs.set(event, subs);
    }
    const callbackRef = React.useRef<Subscription<T>>(cb);
    React.useCallback(() => {
      function subscription(val: T) {
        if (callbackRef.current) {
          callbackRef.current(val);
        }
      }
      subs.add(subscription);
      return () => {
        subs.delete(subscription);
      };
    }, []);
  };
}

export function useEventEmitter<T = void>() {
  const ref = React.useRef<EventEmitter<T>>();
  if (!ref.current) {
    ref.current = new EventEmitter();
  }
  return ref.current;
}
