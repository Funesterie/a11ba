type Message = {
    id: string;
    role: 'user' | 'assistant' | 'system';
    text: string;
    t: number;
};
type Session = {
    id: string;
    messages: Message[];
    createdAt: number;
};
export declare function startSession(systemPrompt?: string): Session;
export declare function sendMessage(sessionId: string, role: 'user' | 'assistant' | 'system', text: string): Message;
export declare function getHistory(sessionId: string): Message[];
export declare function endSession(sessionId: string): boolean;
export declare function encodeAscii4(text: string): {
    ch: string;
    hex4: string;
}[];
export declare function colorizeAscii4(text: string): string;
declare const _default: {
    startSession: typeof startSession;
    sendMessage: typeof sendMessage;
    getHistory: typeof getHistory;
    endSession: typeof endSession;
    encodeAscii4: typeof encodeAscii4;
    colorizeAscii4: typeof colorizeAscii4;
};
export default _default;
