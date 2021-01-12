import React from 'react';
import { EventEmitter } from '../hooks/useEventEmitter';
interface SimpleStateEvent {
    type: string;
    keys: string[];
    data: any;
    state: any;
}
declare type Updater<T> = (state: T) => void;
interface UseRet<T> {
    state: T;
    update: (updater: Updater<T>) => void;
}
export declare class SimpleState<T> {
    private state;
    constructor(iniState: T);
    event: EventEmitter<SimpleStateEvent>;
    update: (updater: Updater<T>) => void;
    getState: () => T;
}
export declare function getSimpleContext<S>(iniState?: S): {
    Provider: React.FC<{
        iniState: any;
    }>;
    useSimpleContext: (subKeys: string[]) => UseRet<S>;
};
export {};
