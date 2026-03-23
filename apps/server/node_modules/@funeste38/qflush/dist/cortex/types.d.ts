export interface CortexPacket {
    version?: number;
    kind?: 'cortex-packet';
    type?: string;
    id?: string;
    payload: any;
    totalLen?: number;
    payloadLen?: number;
    flags?: number;
}
