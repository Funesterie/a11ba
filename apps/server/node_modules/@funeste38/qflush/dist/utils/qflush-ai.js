"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.qflushAi = qflushAi;
const child_process_1 = require("child_process");
function buildArgs(options) {
    const args = ['ai', 'prompt', options.prompt];
    if (options.profile)
        args.push('--profile', options.profile);
    if (options.mode)
        args.push('--mode', options.mode);
    return args;
}
async function runOpenAiCli(args) {
    return new Promise((resolve, reject) => {
        const proc = (0, child_process_1.spawn)('openai', args, { shell: true });
        let stdout = '';
        let stderr = '';
        proc.stdout.on('data', (data) => { stdout += data.toString(); });
        proc.stderr.on('data', (data) => { stderr += data.toString(); });
        proc.on('close', (code) => {
            if (code === 0)
                resolve(stdout.trim());
            else
                reject(new Error(stderr.trim() || `openai CLI exited with code ${code}`));
        });
    });
}
async function qflushAi(options) {
    const mode = options.mode || 'auto';
    const profile = options.profile || 'default';
    if (mode === 'local' || mode === 'auto') {
        try {
            const args = buildArgs({ ...options, mode: 'local', profile });
            const localResult = await runOpenAiCli(args);
            if (localResult)
                return localResult;
            if (mode === 'local')
                throw new Error('Local AI failed');
        }
        catch (e) {
            if (mode === 'local')
                throw e;
            // fallback to cloud
        }
    }
    // fallback to cloud
    const args = buildArgs({ ...options, mode: 'cloud', profile });
    return await runOpenAiCli(args);
}
