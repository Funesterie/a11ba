// Route TTS (synthèse vocale)
const express = require('express');
const router = express.Router();
const { callTTS } = require('../../tts-call.js');

// POST /api/tts
router.post('/', express.json({ limit: '1mb' }), async (req, res) => {
	try {
		const text = String(req.body?.text || '').trim();
		const voice = String(req.body?.voice || req.body?.model || '').trim();
		if (!text) {
			return res.status(400).json({ error: 'Texte manquant' });
		}
		const result = await callTTS({ text, voice, model: voice || undefined });
		res.json(result);
	} catch (e) {
		res.status(500).json({ error: 'TTS error', details: String(e) });
	}
});

module.exports = router;
