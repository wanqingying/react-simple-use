declare type Subscription<T> = (val: T) => void;
export declare class EventEmitter<T> {
    private subs;
    emit: (event: string, val: T) => void;
    useSubscription: (event: string, cb: Subscription<T>) => void;
}
export declare function useEventEmitter<T = void>(): EventEmitter<T>;
export {};
