import type { CortexPacket } from "./types.js";
export type CortexRouteHandler = (packet: CortexPacket, services?: any) => Promise<any> | any;
export declare function routeCortexPacket(packet: CortexPacket, services?: any): Promise<any>;
declare const _default: {
    routeCortexPacket: typeof routeCortexPacket;
};
export default _default;
