export declare function cortexEmit(eventName: string, payload: any): void;
export declare function onCortexEvent(eventName: string, cb: (p: any) => void): void;
declare const _default: {
    cortexEmit: typeof cortexEmit;
    onCortexEvent: typeof onCortexEvent;
};
export default _default;
