"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.askOpenAI = askOpenAI;
exports.streamOpenAI = streamOpenAI;
const openai_1 = __importDefault(require("openai"));
const client = new openai_1.default({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.A11_OPENAI_BASE_URL || "https://api.openai.com/v1",
});
const DEFAULT_MODEL = process.env.A11_OPENAI_MODEL || "gpt-5.1";
async function askOpenAI(opts) {
    const model = opts.model || DEFAULT_MODEL;
    const response = await client.chat.completions.create({
        model,
        messages: opts.messages,
        stream: false,
    });
    const msg = response.choices[0]?.message?.content || "";
    return msg;
}
async function streamOpenAI(opts, onChunk) {
    const model = opts.model || DEFAULT_MODEL;
    const stream = await client.chat.completions.create({
        model,
        messages: opts.messages,
        stream: true,
    });
    for await (const part of stream) {
        const delta = part.choices[0]?.delta?.content || "";
        if (delta) {
            onChunk(delta);
        }
    }
}
