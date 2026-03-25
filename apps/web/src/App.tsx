import React, { useEffect, useState, useRef, useMemo } from "react";
import { fetchA11HistoryList, fetchA11Conversation, login, logout, getAuthToken, forgotPassword, resetPassword, purgeMemoryNow } from "./lib/api";
import { A11HistoryPanel } from "./components/A11HistoryPanel";
import ReactMarkdown from "react-markdown";
import "./index.css";
import {
  initSpeech,
  startMic,
  stopMic,
  speak,
  cancelSpeech,
  setSpeechMuted,
  isSpeechMuted,
  retryPlayUrl,
} from "./lib/speech";
import handleImportFiles from "./lib/importer";
import { chatCompletion, type Provider } from "./lib/api";

type Role = "user" | "assistant" | "system";

interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  imageUrl?: string | null;
}

interface PurgeHistoryEntry {
  at: string;
  dryRun: boolean;
  removed: { facts: number; tasks: number; files: number };
}

interface LlmStats {
  ok: boolean;
  backend?: string;
  model?: string;
  mode?: string;
  gpu?: boolean;
}

const DEFAULT_SYSTEM_NINDO =
  "Tu es A-11, assistant local. Réponds de façon concise, claire et directe. N'invente pas de contexte. Ne fais aucune action et ne proposes aucune action non demandée explicitement. Si la question est triviale, réponds en une phrase maximum.";
// ✅ LOGIN PANEL
function LoginPanel({ onLoginSuccess }: readonly { onLoginSuccess: () => void }) {
  const [username, setUsername] = useState("Djeff");
  const [password, setPassword] = useState("1991");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [error, setError] = useState("");
  const [forgotError, setForgotError] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(username, password);
      onLoginSuccess();
    } catch (err) {
      setError((err as Error).message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError("");
    setForgotSent(false);
    if (!forgotEmail.trim()) {
      setForgotError("Email requis");
      return;
    }
    setForgotLoading(true);
    try {
      await forgotPassword(forgotEmail.trim());
      setForgotSent(true);
    } catch (err) {
      setForgotError((err as Error).message || "Erreur forgot password");
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", gap: "20px" }}>
      <h1>🔐 A-11 Login</h1>
      <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "15px", minWidth: "300px" }}>
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={loading}
          style={{ padding: "10px", borderRadius: "4px", border: "1px solid #ccc" }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
          style={{ padding: "10px", borderRadius: "4px", border: "1px solid #ccc" }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "10px 20px",
            borderRadius: "4px",
            border: "none",
            background: "#007bff",
            color: "white",
            cursor: "pointer",
            fontWeight: "bold"
          }}
        >
          {loading ? "Logging in..." : "Login"}
        </button>
        {error && <div style={{ color: "red", fontSize: "14px" }}>{error}</div>}
      </form>
      <form onSubmit={handleForgot} style={{ display: "flex", flexDirection: "column", gap: "10px", minWidth: "300px", marginTop: "10px" }}>
        <div style={{ fontSize: "13px", color: "#94a3b8" }}>Mot de passe oublié ?</div>
        <input
          type="email"
          placeholder="Ton email"
          value={forgotEmail}
          onChange={(e) => setForgotEmail(e.target.value)}
          disabled={forgotLoading}
          style={{ padding: "10px", borderRadius: "4px", border: "1px solid #ccc" }}
        />
        <button
          type="submit"
          disabled={forgotLoading}
          style={{
            padding: "10px 20px",
            borderRadius: "4px",
            border: "1px solid #334155",
            background: "#0f172a",
            color: "#e2e8f0",
            cursor: "pointer",
            fontWeight: "bold"
          }}
        >
          {forgotLoading ? "Envoi..." : "Envoyer le lien de reset"}
        </button>
        {forgotError && <div style={{ color: "red", fontSize: "13px" }}>{forgotError}</div>}
        {forgotSent && <div style={{ color: "#22c55e", fontSize: "13px" }}>Si l'email existe, un lien a ete envoye.</div>}
      </form>
      <p style={{ fontSize: "12px", color: "#999" }}>Admin: Djeff / 1991</p>
    </div>
  );
}

function ResetPasswordPanel() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const token = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('token') || '';
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (!token) {
      setError("Token manquant dans l'URL");
      return;
    }
    if (password.length < 4) {
      setError("Mot de passe trop court");
      return;
    }
    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas");
      return;
    }

    setLoading(true);
    try {
      await resetPassword(token, password);
      setSuccess(true);
    } catch (err) {
      setError((err as Error).message || "Reset impossible");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", gap: "20px" }}>
      <h1>Reset Password</h1>
      <form onSubmit={handleReset} style={{ display: "flex", flexDirection: "column", gap: "12px", minWidth: "320px" }}>
        <input
          type="password"
          placeholder="Nouveau mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
          style={{ padding: "10px", borderRadius: "4px", border: "1px solid #ccc" }}
        />
        <input
          type="password"
          placeholder="Confirmer le mot de passe"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={loading}
          style={{ padding: "10px", borderRadius: "4px", border: "1px solid #ccc" }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "10px 20px",
            borderRadius: "4px",
            border: "none",
            background: "#16a34a",
            color: "white",
            cursor: "pointer",
            fontWeight: "bold"
          }}
        >
          {loading ? "Reset..." : "Valider"}
        </button>
        {error && <div style={{ color: "red", fontSize: "14px" }}>{error}</div>}
        {success && (
          <div style={{ color: "#22c55e", fontSize: "14px" }}>
            Mot de passe modifie. Tu peux revenir sur la page de login.
          </div>
        )}
      </form>
    </div>
  );
}
// MuteButton : icône seule, contrôle global du son
function MuteButton() {
  const [muted, setMuted] = useState(isSpeechMuted());

  useEffect(() => {
    try {
      const saved = localStorage.getItem('a11:muted');
      if (saved === '1') setMuted(true);
    } catch {
      // ignore storage access errors
    }
  }, []);

  useEffect(() => {
    setSpeechMuted(muted);
    if (muted) {
      cancelSpeech();
    }

    try {
      localStorage.setItem('a11:muted', muted ? '1' : '0');
    } catch {
      // ignore storage access errors
    }
  }, [muted]);

  return (
    <button
      onClick={() => setMuted(m => !m)}
      title={muted ? "Rétablir la voix d'A11" : "Couper la voix d'A11"}
      style={{ fontSize: 20, padding: 6, width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      className="btn ghost"
    >
      {muted ? (
        <span role="img" aria-label="Audio coupé">🔇</span>
      ) : (
        <span role="img" aria-label="Audio actif">🔊</span>
      )}
    </button>
  );
}

export function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isResetRoute, setIsResetRoute] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "sys-1",
      role: "system",
      content: DEFAULT_SYSTEM_NINDO,
    },
  ]);
  const [ttsFallback, setTtsFallback] = useState(false);
  const [audioBlockedUrl, setAudioBlockedUrl] = useState<string | null>(null);

  // Audio-blocked banner: listen for autoplay block events
  useEffect(() => {
    const onBlocked = (e: Event) => {
      const url = (e as CustomEvent).detail?.url;
      if (url) setAudioBlockedUrl(url);
    };
    const onSpeechStart = () => setAudioBlockedUrl(null);
    globalThis.addEventListener('a11:audioBlocked', onBlocked);
    globalThis.addEventListener('a11:speechstart', onSpeechStart);
    return () => {
      globalThis.removeEventListener('a11:audioBlocked', onBlocked);
      globalThis.removeEventListener('a11:speechstart', onSpeechStart);
    };
  }, []);

  // Check if already authenticated on mount
  useEffect(() => {
    const token = getAuthToken();
    if (token) {
      setIsAuthenticated(true);
    }
    const pathname = window.location.pathname.toLowerCase();
    setIsResetRoute(pathname.includes('/reset-password') || pathname.includes('/reset'));
  }, []);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const stats: LlmStats | null = null;
  const [voiceListening, setVoiceListening] = useState(false);
  const audioPlaying = false;
  const [devMode, setDevMode] = useState(false);
  const speaking = false;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const toggleLockRef = useRef(false);
  const [model, setModel] = useState("gpt-4o-mini");

  // Chats state persisted in localStorage
  const [chats, setChats] = useState<{
    id: string;
    name: string;
    updated: number;
    messages: ChatMessage[];
  }[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  // Historique A-11 (backend)
  const [a11History, setA11History] = useState<any[]>([]);
  const [a11ConvId, setA11ConvId] = useState<string | null>(null);
  const [a11ConvMsgs, setA11ConvMsgs] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [activeView, setActiveView] = useState<'chat' | 'admin'>('chat');
  const [purgingMemory, setPurgingMemory] = useState(false);
  const [purgeFeedback, setPurgeFeedback] = useState<string>("");
  const [memoryPurgeDryRun, setMemoryPurgeDryRun] = useState(true);
  const [purgeHistory, setPurgeHistory] = useState<PurgeHistoryEntry[]>([]);

  // load chats from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem("a11:chats");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) {
          // sanitize chats and messages to conform to expected types
          const sanitizeRole = (r: any) => (r === 'user' || r === 'assistant' || r === 'system') ? r as Role : 'assistant' as Role;
          const normalizeSystemContent = (content: string) => {
            const value = String(content || '');
            if (
              value.includes('utilise les capacités locales') ||
              value.includes('assistant local NOSSEN')
            ) {
              return DEFAULT_SYSTEM_NINDO;
            }
            return value;
          };
          const sanitized = parsed.map((c: any) => ({
            id: String(c.id || `chat-${Date.now()}`),
            name: String(c.name || 'Conversation'),
            updated: Number(c.updated) || Date.now(),
            messages: Array.isArray(c.messages) ? c.messages.map((m: any) => {
              const role = sanitizeRole(m.role);
              const rawContent = String(m.content || '');
              return {
                id: String(m.id || (`m-${Date.now()}`)),
                role,
                content: role === 'system' ? normalizeSystemContent(rawContent) : rawContent
              };
            }) : [{ id: `sys-${Date.now()}`, role: 'system' as Role, content: DEFAULT_SYSTEM_NINDO }]
          }));
          setChats(sanitized);
          setSelectedChatId(sanitized[0].id);
          setMessages(sanitized[0].messages || [{ id: `sys-${Date.now()}`, role: 'system' as Role, content: DEFAULT_SYSTEM_NINDO }]);
          return;
        }
      }
    } catch (e) {
      console.warn("[A11] failed to load chats", e);
    }
    // default chat
    const initial = [
      {
        id: "chat-1",
        name: "Session actuelle",
        updated: Date.now(),
        messages: [
          { id: `sys-${Date.now()}`, role: 'system' as Role, content: DEFAULT_SYSTEM_NINDO },
        ],
      },
    ];
    setChats(initial);
    setSelectedChatId(initial[0].id);
    setMessages(initial[0].messages);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('a11:memory-purge-history');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setPurgeHistory(
          parsed
            .filter((item: any) => item && typeof item.at === 'string')
            .slice(0, 10)
        );
      }
    } catch {
      // ignore corrupted local history
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('a11:memory-purge-history', JSON.stringify(purgeHistory.slice(0, 10)));
    } catch {
      // ignore storage failures
    }
  }, [purgeHistory]);

  // persist chats whenever changed
  useEffect(() => {
    try {
      localStorage.setItem("a11:chats", JSON.stringify(chats));
    } catch (e) {
      console.warn("[A11] failed to save chats", e);
    }
  }, [chats]);

  // helper to update messages for selected chat
  function updateChatMessages(chatId: string | null, newMessages: ChatMessage[]) {
    if (!chatId) return;
    setChats((prev) =>
      prev.map((c) =>
        c.id === chatId ? { ...c, messages: newMessages, updated: Date.now() } : c
      )
    );
  }

  function onImportClick() {
    fileInputRef.current?.click();
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    handleImportFiles(e.target.files, (txt: string) => {
      setInput((prev) => (prev ? prev + "\n" + txt : txt));
    }).catch(console.error);
  }

  // New conversation handler
  function newConversation() {
    // create new chat entry and select it
    const id = `chat-${Date.now()}`;
    const newChat = {
      id,
      name: `Conversation ${chats.length + 1}`,
      updated: Date.now(),
      messages: [{ id: `sys-${Date.now()}`, role: 'system' as Role, content: DEFAULT_SYSTEM_NINDO }],
    };
    setChats((prev) => [newChat, ...prev]);
    setSelectedChatId(id);
    setMessages(newChat.messages);
    setInput("");
  }

  // Speech recognition callback
  useEffect(() => {
    initSpeech((txt: string, isFinal?: boolean) => {
      if (isFinal) {
        setInput(""); // vide l'input
        sendMessage(txt); // envoie direct le texte reconnu
      } else {
        setInput(() => txt);
      }
    });
  }, []);

  // Modifie la fonction sendMessage pour accepter un texte forcé
  async function sendMessage(forcedText?: string) {
    const text = (forcedText ?? input).trim();
    if (!text || sending) return;

    // Ajout du préfixe DEV_ENGINE si mode dev
    const prefix = devMode ? "[DEV_ENGINE] " : "";
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}}`,
      role: "user",
      content: prefix + text,
    };
    setMessages((prev) => {
      const nm = [...prev, userMsg];
      updateChatMessages(selectedChatId, nm);
      return nm;
    });
    setInput("");
    setSending(true);

    try {
      // Utilisation de chatCompletion pour transmettre le prompt et le flag dev
      // On reconstruit l'historique sans les messages système (le prompt système est passé séparément)
      const history = messages.filter(m => m.role !== 'system').concat(userMsg);
      const provider: Provider = model.startsWith('gpt') ? 'openai' : 'local';
      const assistantText = await chatCompletion(
        history,
        provider,
        {
          model,
          systemPrompt: systemPrompt,
          a11Dev: devMode
        }
      );

      const aiMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: String(assistantText),
      };
      setMessages((prev) => {
        const nm = [...prev, aiMsg];
        updateChatMessages(selectedChatId, nm);
        return nm;
      });

      // Pipeline auto: LLM reply -> TTS playback
      speak(String(assistantText), { lang: "fr-FR" });
    } catch (err: any) {
      const errMsg: ChatMessage = {
        id: `e-${Date.now()}`,
        role: "assistant",
        content:
          "Erreur lors de l’appel à /api/llm/chat : " + (err?.message || err),
      };
      setMessages((prev) => {
        const nm = [...prev, errMsg];
        updateChatMessages(selectedChatId, nm);
        return nm;
      });
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  async function toggleMic() {
    console.log("[A11] toggleMic clicked, current voiceListening=", voiceListening);
    // If audio is playing, stop it immediately and do not toggle modes
    if (audioPlaying) {
      console.log("[A11] canceling audio playback via toggle");
      cancelSpeech();
      return;
    }
    const SpeechRecognition =
      (globalThis as any).SpeechRecognition ||
      (globalThis as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      if (toggleLockRef.current) {
        console.log("[A11] toggle ignored due to lock");
        return;
      }
      toggleLockRef.current = true;
      setTimeout(() => { toggleLockRef.current = false; }, 600);
      // fallback: toggle TTS-only mode
      setTtsFallback((v) => {
        const next = !v;
        // keep voiceListening false when using fallback
        if (next) {
          // enable TTS playback
          console.log("[A11] SpeechRecognition not available — enabling TTS-only mode");
        } else {
          console.log("[A11] Disabling TTS-only mode");
        }
        return next;
      });
      return;
    }

    if (voiceListening) {
      try { stopMic(); } catch {};
      setVoiceListening(false);
      cancelSpeech();
    } else {
      try { await startMic(); setVoiceListening(true); } catch (e) { console.warn('startMic failed', e); }
    }
  }

  function toggleTtsOnly() {
    if (toggleLockRef.current) {
      console.log('[A11] toggleTtsOnly ignored due to lock');
      return;
    }
    toggleLockRef.current = true;
    setTimeout(() => { toggleLockRef.current = false; }, 600);
    const next = !ttsFallback;
    setTtsFallback(next);
    console.log('[A11] toggleTtsOnly ->', next);
    if (next) {
      localStorage.setItem('a11:tts-only', '1');
    } else {
      localStorage.removeItem('a11:tts-only');
    }
  }

  // Rename chat
  function renameChat(id: string) {
    const c = chats.find(x => x.id === id);
    if (!c) return;
    const name = prompt('Nouveau nom de la conversation', c.name);
    if (!name) return;
    setChats(prev => prev.map(x => x.id === id ? { ...x, name } : x));
  }

  // Delete chat
  function deleteChat(id: string) {
    if (!confirm('Supprimer cette conversation ?')) return;
    setChats(prev => {
      const next = prev.filter(x => x.id !== id);
      if (next.length === 0) {
        // recreate default
        const initial = { id: 'chat-1', name: 'Session actuelle', updated: Date.now(), messages: [{ id: `sys-${Date.now()}`, role: 'system' as Role, content: DEFAULT_SYSTEM_NINDO }] };
        setSelectedChatId(initial.id);
        setMessages(initial.messages);
        return [initial];
      }
      // select first if deleted was selected
      if (selectedChatId === id) {
        setSelectedChatId(next[0].id);
        setMessages(next[0].messages);
      }
      return next;
    });
  }

  // NINDO layers (à adapter selon ton code)
  const nindoLayers = {
    core: DEFAULT_SYSTEM_NINDO,
    dev: '',
    project: '',
    session: '',
  };

  // Prompt système pour le mode CHAT normal
  const systemPromptChat = useMemo(() => {
    const parts: string[] = [];
    parts.push(`# NINDO CORE\n${nindoLayers.core}`);
    if (nindoLayers.project.trim()) {
      parts.push(`# NINDO PROJET\n${nindoLayers.project}`);
    }
    if (nindoLayers.session.trim()) {
      parts.push(`# NINDO SESSION\n${nindoLayers.session}`);
    }
    // Règle anti-blabla
    parts.push(
      `# RÈGLES\n- Réponds uniquement à la demande de l'utilisateur.\n- N'invente jamais de contexte ou de scénario.\n- Ne propose aucune action non demandée explicitement.\n- Si la demande n'est pas claire, pose une seule question de clarification.\n- Si la question est triviale, réponds en une phrase maximum.`
    );
    return parts.join("\n\n---\n\n");
  }, [nindoLayers]);

  // Prompt système pour le mode DEV (ingé / fichiers)
  const systemPromptDev = useMemo(() => {
    const parts: string[] = [];
    parts.push(`# NINDO CORE\n${nindoLayers.core}`);
    if (nindoLayers.dev.trim()) {
      parts.push(`# NINDO DEV\n${nindoLayers.dev}`);
    }
    if (nindoLayers.project.trim()) {
      parts.push(`# NINDO PROJET\n${nindoLayers.project}`);
    }
    if (nindoLayers.session.trim()) {
      parts.push(`# NINDO SESSION\n${nindoLayers.session}`);
    }
    parts.push(
      `# MODE DEV (A-11 DEVELOPER ENGINE)
- Tu te comportes comme un ingénieur logiciel dans un vrai workspace local.
- Tu peux proposer des actions JSON (mode "actions") pour Cerbère (write_file, generate_pdf, etc.).
- Tu évites les actions destructrices.
- Tu ne t'inventes pas de problème : si tu n'as pas assez de contexte, tu demandes des fichiers / erreurs.

- Quand l'utilisateur demande un PDF explicatif (cours, fiche, dossier, etc.),
  tu dois créer AU MOINS 4 sections détaillées, avec plusieurs paragraphes.
- Utilise de préférence la structure :
  sections = [
    { "heading": "Introduction", "text": "...", "images": [...] },
    { "heading": "Partie 1 : ...", "text": "...", "images": [...] },
    { "heading": "Partie 2 : ...", "text": "...", "images": [...] },
    { "heading": "Conclusion", "text": "..." }
  ]
- Pour inclure une image dans le PDF, elle doit déjà être présente sur le disque.
  D'abord tu utilises l'action "download_file" pour télécharger l'image dans "docs/...",
  ensuite tu passes ce chemin dans "sections[].images".

EN MODE DEV (fichiers / workspace) :
- Si l'utilisateur demande de CRÉER, LIRE, MODIFIER un fichier, un PDF, une image, etc.,
  TU NE RÉPONDS PAS en texte.
- Tu renvoies UNIQUEMENT un JSON valide de la forme :

{ "mode": "actions", "actions": [ { "action": "write_file", "path": "docs/test.txt", "content": "Contenu du fichier..." } ] }

- Pour CRÉER / MODIFIER un fichier texte : utilise "write_file" (champ "content" en texte).
- Pour TÉLÉCHARGER une image ou un fichier depuis une URL : utilise "download_file" avec
  { "action": "download_file", "url": "https://...", "path": "docs/mon_image.png" }.
- Pour CRÉER un PDF structuré : utilise "generate_pdf" avec "title" et "sections"
  (chaque section a "heading", "text" et éventuellement "images" = liste de chemins locaux).

RÈGLES STRICTES :
- Pas de triple backticks autour.
- Pas de mot "json" avant.
- Le PREMIER caractère de ta réponse doit être {.
- Le DERNIER caractère de ta réponse doit être }.
- Aucune explication avant ou après le JSON.`
    );
    return parts.join("\n\n---\n\n");
  }, [nindoLayers]);

  // Prompt effectivement utilisé selon le mode
  const systemPrompt = devMode ? systemPromptDev : systemPromptChat;

  // Initialisation globale de window.speak au montage pour garantir le son
  useEffect(() => {
    (globalThis as any).speak = speak;
  }, [devMode, stats]);

  // Chargement de l'historique backend au montage
  useEffect(() => {
    refreshA11History();
  }, []);

  // Handler pour rafraîchir la liste de l'historique
  async function refreshA11History() {
    setLoadingHistory(true);
    try {
      const list = await fetchA11HistoryList();
      setA11History(list);
    } catch (error_) {
      console.warn('[A11] failed to refresh history', error_);
      setA11History([]);
    } finally {
      setLoadingHistory(false);
    }
  }

  // Handler pour ouvrir/restaurer une conversation backend
  async function handleOpenA11Conversation(convId: string) {
    setA11ConvId(convId);
    setA11ConvMsgs([]);
    setLoadingHistory(true);
    try {
      const conv = await fetchA11Conversation(convId);
      setA11ConvMsgs(conv.messages || []);
    } catch (error_) {
      console.warn('[A11] failed to open conversation', error_);
      setA11ConvMsgs([]);
    } finally {
      setLoadingHistory(false);
    }
  }

  async function handlePurgeMemoryNow() {
    const confirmed = globalThis.confirm('Déclencher un purge-now de la mémoire structurée ?');
    if (!confirmed || purgingMemory) return;

    setPurgingMemory(true);
    setPurgeFeedback('Purge en cours...');
    try {
      const result = await purgeMemoryNow({ dryRun: memoryPurgeDryRun });
      const effectiveRemoved = result.dryRun ? (result.wouldRemove || { facts: 0, tasks: 0, files: 0 }) : result.removed;
      const removedTotal = effectiveRemoved.facts + effectiveRemoved.tasks + effectiveRemoved.files;
      setPurgeFeedback(
        result.dryRun
          ? `Dry run OK (${removedTotal} candidats) • facts ${effectiveRemoved.facts}, tasks ${effectiveRemoved.tasks}, files ${effectiveRemoved.files}`
          : `Purge OK (${removedTotal} supprimés) • facts ${result.before.facts}->${result.after.facts}, tasks ${result.before.tasks}->${result.after.tasks}, files ${result.before.files}->${result.after.files}`
      );
      setPurgeHistory((prev) => [
        {
          at: result.purgeTriggeredAt,
          dryRun: !!result.dryRun,
          removed: {
            facts: effectiveRemoved.facts,
            tasks: effectiveRemoved.tasks,
            files: effectiveRemoved.files,
          },
        },
        ...prev,
      ].slice(0, 10));
    } catch (err) {
      setPurgeFeedback(`Echec purge: ${(err as Error).message || String(err)}`);
    } finally {
      setPurgingMemory(false);
    }
  }

  // HEADER avec bouton Mode DEV centré, select modèle à droite, mute à l'extrême droite
  
  // ✅ Check authentication
  if (isResetRoute) {
    return <ResetPasswordPanel />;
  }

  if (!isAuthenticated) {
    return <LoginPanel onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="app-container" style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header
        className="header"
        style={{
          width: "100%",
          minHeight: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 24px",
          borderBottom: "1px solid #111827",
          background: "#0a101a",
          zIndex: 10,
        }}
      >
        {/* Avatar + nom à gauche */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 999,
              overflow: "hidden",
              boxShadow: "0 0 12px #22d3ee99",
              flexShrink: 0,
            }}
          >
            <img
              id="a11-avatar"
              src={speaking ? "/assets/A11_talking_smooth_8s.gif" : "/assets/a11_static.png"}
              alt="A-11"
              onError={(e) => {
                e.currentTarget.src = "/assets/a11_static.png";
              }}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
          <div>
            <div style={{ fontWeight: 700, color: "#e5e7eb" }}>AlphaOnze (A-11)</div>
            <div style={{ fontSize: 12, color: "#9ca3af" }}>Assistant local NOSSEN</div>
          </div>
        </div>
        {/* Mode DEV centré + badge backend */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 12 }}>
          <button
            type="button"
            onClick={() => setDevMode((v) => !v)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 14px",
              borderRadius: 999,
              border: "1px solid " + (devMode ? "#f97316" : "#1f2937"),
              background: devMode ? "#7c2d12" : "#020617",
              color: devMode ? "#fed7aa" : "#e5e7eb",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: devMode ? "0 0 8px #f9731633" : undefined,
              letterSpacing: 1,
            }}
            title={
              devMode
                ? "Mode DEV activé : A-11 peut modifier des fichiers (via Cerbère)"
                : "Mode DEV désactivé : A-11 reste en mode chat normal"
            }
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: devMode ? "#fb923c" : "#6b7280",
                marginRight: 6,
              }}
            />
            <span>Mode DEV</span>
          </button>
        </div>
        {/* Select modèle + MuteButton + badge backend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <select
            value={model}
            onChange={e => setModel(e.target.value)}
            style={{
              padding: "6px 10px",
              borderRadius: 6,
              background: "#181f2a",
              color: "#e5e7eb",
              border: "1px solid #22293a",
              fontSize: 13,
              marginRight: 2
            }}
          >
            <option value="gpt-4o-mini">gpt-4o-mini</option>
            <option value="gpt-4.1-mini">gpt-4.1-mini</option>
          </select>
          <MuteButton />
          {stats && (
            <div
              style={{
                fontSize: 11,
                padding: "4px 8px",
                borderRadius: 999,
                background: "#0f172a",
                color: "#9ca3af",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  background: stats.gpu ? "#22c55e" : "#eab308",
                }}
              />
              <span>{stats.backend}</span>
              <span style={{ opacity: 0.7 }}>· {stats.model}</span>
            </div>
          )}
        </div>
        <MuteButton />
        {/* ✅ LOGOUT BUTTON */}
        <button
          onClick={() => {
            logout();
            setIsAuthenticated(false);
          }}
          style={{
            padding: "8px 16px",
            borderRadius: "4px",
            border: "1px solid #dc2626",
            background: "transparent",
            color: "#fca5a5",
            cursor: "pointer",
            fontWeight: "bold",
            fontSize: "13px"
          }}
          title="Logout"
        >
          🚪 Logout
        </button>
      </header>
      {/* Grille principale : sidebar + main */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Sidebar : conversations locales + historique backend */}
        <aside className="sidebar" style={{ width: 320, borderRight: "1px solid #22293a", background: "#0a101a", display: 'flex', flexDirection: 'column' }}>
          {/* Bloc conversations locales */}
          <div style={{ borderBottom: '1px solid #22293a', padding: '8px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px 4px 16px' }}>
              <span className="text-xs uppercase tracking-wide text-slate-400">Conversations locales</span>
              <button onClick={newConversation} className="btn ghost" style={{ fontSize: 13, padding: '2px 10px' }}>+ Nouvelle</button>
            </div>
            <div>
              {chats.map(chat => (
                <div
                  key={chat.id}
                  style={{
                    fontWeight: chat.id === selectedChatId ? "bold" : "normal",
                    background: chat.id === selectedChatId ? "#22293a" : "transparent",
                    padding: '6px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderRadius: 6,
                    margin: '2px 8px',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setActiveView('chat');
                      setSelectedChatId(chat.id);
                      setMessages(chat.messages);
                      setA11ConvId(null);
                      setA11ConvMsgs([]);
                    }}
                    className="btn ghost"
                    style={{ flex: 1, padding: 0, border: 'none', background: 'transparent', textAlign: 'left', justifyContent: 'flex-start' }}
                  >
                    {chat.name}
                  </button>
                  <span style={{ display: 'flex', gap: 4 }}>
                    <button onClick={e => { e.stopPropagation(); renameChat(chat.id); }} title="Renommer" className="btn ghost" style={{ fontSize: 13 }}>✏️</button>
                    <button onClick={e => { e.stopPropagation(); deleteChat(chat.id); }} title="Supprimer" className="btn ghost" style={{ fontSize: 13 }}>🗑️</button>
                  </span>
                </div>
              ))}
            </div>
          </div>
          {/* Historique backend */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-slate-400">
                Historique A-11
              </span>
              <button onClick={refreshA11History} className="text-[11px] text-slate-400 hover:text-slate-200">
                ↻
              </button>
            </div>
            {loadingHistory ? (
              <div className="p-3 text-xs text-slate-400">Chargement…</div>
            ) : (
              <A11HistoryPanel
                items={a11History}
                activeId={a11ConvId}
                onSelect={handleOpenA11Conversation}
              />
            )}
          </div>
          <div style={{ borderTop: '1px solid #22293a', padding: '8px 12px' }}>
            <div className="text-xs uppercase tracking-wide text-slate-400" style={{ marginBottom: 8 }}>
              Administration
            </div>
            <button
              type="button"
              onClick={() => setActiveView('admin')}
              className="btn ghost"
              style={{ width: '100%', justifyContent: 'flex-start', border: activeView === 'admin' ? '1px solid #334155' : undefined }}
            >
              Memory Controls
            </button>
          </div>
        </aside>
        {/* ...main... */}
        <main className="main" style={{ flex: 1, minWidth: 0 }}>
          {activeView === 'admin' ? (
            <div style={{ padding: 20, maxWidth: 760 }}>
              <h2 style={{ marginTop: 0, color: '#e2e8f0' }}>Administration mémoire</h2>
              <p style={{ color: '#94a3b8', marginTop: 4 }}>
                Contrôle dédié pour lancer la purge de la mémoire structurée.
              </p>

              <div style={{
                marginTop: 16,
                padding: 14,
                border: '1px solid #1f2937',
                borderRadius: 10,
                background: '#0b1220',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
              }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#cbd5e1', fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={memoryPurgeDryRun}
                    onChange={(e) => setMemoryPurgeDryRun(e.target.checked)}
                    disabled={purgingMemory}
                  />
                  Dry run (simulation sans suppression)
                </label>
                <button
                  type="button"
                  onClick={handlePurgeMemoryNow}
                  disabled={purgingMemory}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid #f59e0b',
                    background: purgingMemory ? '#3f2a08' : 'transparent',
                    color: '#fcd34d',
                    cursor: purgingMemory ? 'not-allowed' : 'pointer',
                    fontWeight: 700,
                    fontSize: 12,
                  }}
                >
                  {purgingMemory ? 'Execution...' : 'Lancer purge maintenant'}
                </button>
              </div>

              {purgeFeedback && (
                <div style={{
                  marginTop: 14,
                  padding: 10,
                  borderRadius: 8,
                  border: `1px solid ${purgeFeedback.startsWith('Echec') ? '#7f1d1d' : '#1e3a8a'}`,
                  background: purgeFeedback.startsWith('Echec') ? '#2a0f0f' : '#0f172a',
                  color: purgeFeedback.startsWith('Echec') ? '#fecaca' : '#bfdbfe',
                  fontSize: 12,
                }}>
                  {purgeFeedback}
                </div>
              )}

              <div style={{ marginTop: 18 }}>
                <h3 style={{ margin: 0, color: '#e2e8f0', fontSize: 16 }}>Historique local</h3>
                {purgeHistory.length === 0 ? (
                  <div style={{ marginTop: 8, color: '#94a3b8', fontSize: 13 }}>Aucune purge locale pour le moment.</div>
                ) : (
                  <div style={{ marginTop: 8, border: '1px solid #1f2937', borderRadius: 8, overflow: 'hidden' }}>
                    {purgeHistory.map((entry, index) => (
                      <div
                        key={`${entry.at}-${index}`}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 10,
                          padding: '10px 12px',
                          borderTop: index === 0 ? 'none' : '1px solid #1f2937',
                          background: index % 2 === 0 ? '#0b1220' : '#0a101a',
                          color: '#cbd5e1',
                          fontSize: 12,
                        }}
                      >
                        <span>{new Date(entry.at).toLocaleString()}</span>
                        <span>{entry.dryRun ? 'dryRun' : 'purge'}</span>
                        <span>facts {entry.removed.facts} | tasks {entry.removed.tasks} | files {entry.removed.files}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
          <div className="scroll-frame">
            <div className="log">
              {(a11ConvMsgs.length ? a11ConvMsgs : messages).map((m, idx) => {
                let messageClassName = "message ";
                let roleLabel = "Système / Nindo";
                if (m.role === "user") {
                  messageClassName = "message user";
                  roleLabel = "Toi";
                } else if (m.role === "assistant") {
                  messageClassName = "message assistant";
                  roleLabel = "A-11";
                }
                const contentNode = m.role === "assistant"
                  ? <ReactMarkdown>{m.content}</ReactMarkdown>
                  : <div>{m.content}</div>;

                return (
                  <div
                    key={m.id || idx}
                    className={messageClassName}
                  >
                    <div className="role">{roleLabel}</div>
                    {contentNode}
                    {m.imageUrl && (
                      <div className="msg-image">
                        <img
                          src={m.imageUrl}
                          alt="Résultat A-11"
                          style={{ maxWidth: "320px", borderRadius: 12 }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="composer">
            <div className="row">
              <button
                type="button"
                className="btn ghost import-inline"
                onClick={onImportClick}
                title="Importer un fichier texte"
                style={{ marginRight: 8 }}
              >
                Importer
              </button>

              <textarea
                placeholder="Demande quelque chose à A-11…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
              />

              <button
                type="button"
                className="send-button"
                onClick={() => sendMessage()}
                disabled={sending || !input.trim()}
                title="Entrée pour envoyer, Shift+Entrée pour aller à la ligne"
              >
                {sending ? "…" : "➤"}
              </button>

              <button
                type="button"
                className={`nossen-mic-btn inline ${(voiceListening || ttsFallback || audioPlaying) ? 'listening' : ''}`}
                onClick={toggleMic}
                title="Toggle microphone / TTS"
                style={{ marginLeft: 8 }}
              >
                {(voiceListening || ttsFallback || audioPlaying) ? '🎙️' : '🎤'}
              </button>
            </div>
            <div className="hint">
              Entrée pour envoyer · Shift+Entrée pour aller à la ligne
            </div>
            <input
              ref={fileInputRef}
              type="file"
              style={{ display: 'none' }}
              onChange={onFileChange}
            />
          </div>
          )}
        </main>
      </div>
      <footer className="footer">
        A-11 / Qflush UI · Cerbère 4545 · LLaMA local · Funesterie
      </footer>
      {showHistory && <HistoryPanel onClose={() => setShowHistory(false)} />}
      {audioBlockedUrl && (
        <div style={{
          position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
          background: '#1e293b', border: '1px solid #334155', borderRadius: 12,
          padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: '0 4px 24px rgba(0,0,0,0.6)', zIndex: 9999,
          color: '#e2e8f0', fontSize: 14, whiteSpace: 'nowrap',
        }}>
          <span>🔇 Audio bloqué</span>
          <button
            type="button"
            onClick={() => { retryPlayUrl(audioBlockedUrl); setAudioBlockedUrl(null); }}
            style={{
              background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8,
              padding: '6px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            }}
          >
            ▶ Jouer
          </button>
          <button
            type="button"
            onClick={() => setAudioBlockedUrl(null)}
            style={{ background: 'none', color: '#94a3b8', border: 'none', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 2px' }}
            title="Ignorer"
          >×</button>
        </div>
      )}
    </div>
  );
}

export default App;