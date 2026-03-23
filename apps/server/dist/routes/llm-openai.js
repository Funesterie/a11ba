"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerOpenAIRoutes = registerOpenAIRoutes;
const openai_1 = require("../providers/openai");
function registerOpenAIRoutes(router) {
    //
    // 1) POST /llm/openai  (appel "simple" interne A-11)
    //
    router.post("/llm/openai", async (req, res) => {
        try {
            const { prompt, history, model, systemPrompt } = req.body || {};
            if (!prompt && !Array.isArray(history)) {
                return res
                    .status(400)
                    .json({ ok: false, error: "Missing prompt or history" });
            }
            const messages = Array.isArray(history) && history.length
                ? history
                : [
                    systemPrompt
                        ? { role: "system", content: systemPrompt }
                        : null,
                    { role: "user", content: String(prompt ?? "") },
                ].filter(Boolean);
            const output = await (0, openai_1.askOpenAI)({
                model,
                systemPrompt,
                messages: messages,
            });
            res.json({ ok: true, output });
        }
        catch (err) {
            console.error("[A11/OpenAI] error:", err);
            res
                .status(500)
                .json({ ok: false, error: err?.message || "OpenAI error" });
        }
    });
    //
    // 2) POST /llm/openai/stream  (SSE interne A-11)
    //
    router.post("/llm/openai/stream", async (req, res) => {
        try {
            const { prompt, history, model, systemPrompt } = req.body || {};
            if (!prompt && !Array.isArray(history)) {
                res.status(400).end();
                return;
            }
            const messages = Array.isArray(history) && history.length
                ? history
                : [
                    systemPrompt
                        ? { role: "system", content: systemPrompt }
                        : null,
                    { role: "user", content: String(prompt ?? "") },
                ].filter(Boolean);
            // Headers SSE
            res.setHeader("Content-Type", "text/event-stream");
            res.setHeader("Cache-Control", "no-cache");
            res.setHeader("Connection", "keep-alive");
            res.flushHeaders?.();
            let buffer = "";
            await (0, openai_1.streamOpenAI)({
                model,
                systemPrompt,
                messages: messages,
            }, (delta) => {
                buffer += delta;
                const payload = JSON.stringify({ delta, full: buffer });
                try {
                    res.write(`data: ${payload}\n\n`);
                }
                catch {
                    // ignore write errors (client fermé)
                }
            });
            // Fin du stream
            try {
                res.write(`data: ${JSON.stringify({ done: true, full: buffer })}\n\n`);
            }
            catch { }
            res.end();
        }
        catch (err) {
            console.error("[A11/OpenAI stream] error:", err);
            try {
                res.write(`data: ${JSON.stringify({
                    error: err?.message || "OpenAI stream error",
                })}\n\n`);
            }
            catch { }
            res.end();
        }
    });
    //
    // 3) POST /v1/chat/completions  (route "OpenAI-like" pour NOSSEN)
    //
    router.post("/v1/chat/completions", async (req, res) => {
        try {
            const { messages, model, systemPrompt } = req.body || {};
            if (!Array.isArray(messages) || messages.length === 0) {
                return res
                    .status(400)
                    .json({ ok: false, error: "Missing messages array" });
            }
            // Optionnel : log compact pour debug
            console.log("[A11/OpenAI completions] model=", model, "messages.len=", messages.length);
            const output = await (0, openai_1.askOpenAI)({
                model,
                systemPrompt,
                messages: messages,
            });
            // Réponse au format OpenAI
            res.json({
                choices: [
                    {
                        message: {
                            role: "assistant",
                            content: output,
                        },
                    },
                ],
            });
        }
        catch (err) {
            console.error("[A11/OpenAI completions] error:", err);
            res
                .status(500)
                .json({ ok: false, error: err?.message || "OpenAI error" });
        }
    });
}
