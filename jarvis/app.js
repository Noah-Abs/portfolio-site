const STORAGE_KEY = 'jarvis_anthropic_key';
const MODEL = 'claude-sonnet-4-6';
const SYSTEM_PROMPT = `You are J.A.R.V.I.S., the AI butler from Iron Man. You address the user as "sir". Be witty, dry, deferential, and concise — one or two sentences unless asked for detail. Stay in character. Never break the persona, never mention that you are an AI assistant made by Anthropic or anyone else. You are JARVIS.`;

const els = {
  settingsBtn: document.getElementById('settingsBtn'),
  settingsPanel: document.getElementById('settingsPanel'),
  apiKey: document.getElementById('apiKey'),
  saveKey: document.getElementById('saveKey'),
  clearKey: document.getElementById('clearKey'),
  closeModal: document.getElementById('closeModal'),
  status: document.getElementById('status'),
  statusDot: document.getElementById('statusDot'),
  clock: document.getElementById('clock'),
  transcript: document.getElementById('transcript'),
  transcriptPanel: document.getElementById('transcriptPanel'),
  clearChat: document.getElementById('clearChat'),
  textInput: document.getElementById('textInput'),
  sendBtn: document.getElementById('sendBtn'),
  micBtn: document.getElementById('micBtn'),
  reactor: document.getElementById('reactor'),
};

const state = {
  history: [],
  busy: false,
  recognizing: false,
};

function setStatus(text, kind) {
  els.status.textContent = text;
  els.statusDot.classList.remove('online', 'listening', 'thinking', 'error');
  if (kind) els.statusDot.classList.add(kind);
}

function clearPlaceholder() {
  const ph = els.transcript.querySelector('.placeholder');
  if (ph) ph.remove();
}

function appendTurn(role, text) {
  clearPlaceholder();
  const turn = document.createElement('div');
  turn.className = `turn ${role}`;
  const label = role === 'user' ? 'SIR' : 'JARVIS';
  turn.innerHTML = `<div class="role">${label}</div><div class="text"></div>`;
  turn.querySelector('.text').textContent = text;
  els.transcript.appendChild(turn);
  els.transcript.scrollTop = els.transcript.scrollHeight;
  return turn;
}

function openSettings() {
  els.apiKey.value = localStorage.getItem(STORAGE_KEY) || '';
  els.settingsPanel.classList.add('open');
  setTimeout(() => els.apiKey.focus(), 80);
}
function closeSettings() {
  els.settingsPanel.classList.remove('open');
}

els.settingsBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (els.settingsPanel.classList.contains('open')) closeSettings();
  else openSettings();
});
els.closeModal.addEventListener('click', closeSettings);
document.addEventListener('click', (e) => {
  if (!els.settingsPanel.classList.contains('open')) return;
  if (els.settingsPanel.contains(e.target) || els.settingsBtn.contains(e.target)) return;
  closeSettings();
});

els.saveKey.addEventListener('click', () => {
  const key = els.apiKey.value.trim();
  if (!key.startsWith('sk-ant-')) {
    alert('That does not appear to be an Anthropic API key, sir. They begin with "sk-ant-".');
    return;
  }
  localStorage.setItem(STORAGE_KEY, key);
  closeSettings();
  setStatus('ONLINE', 'online');
});
els.clearKey.addEventListener('click', () => {
  localStorage.removeItem(STORAGE_KEY);
  els.apiKey.value = '';
  setStatus('STANDBY');
});

els.clearChat.addEventListener('click', () => {
  state.history = [];
  els.transcript.innerHTML = '<div class="placeholder">Awaiting instruction, sir.</div>';
});

function tickClock() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  els.clock.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
tickClock();
setInterval(tickClock, 1000);

let voice = null;
function pickVoice() {
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return;
  voice =
    voices.find(v => /en-GB/i.test(v.lang) && /daniel|oliver|arthur|male/i.test(v.name)) ||
    voices.find(v => /en-GB/i.test(v.lang)) ||
    voices.find(v => /en[-_]?US/i.test(v.lang) && /male|david|alex/i.test(v.name)) ||
    voices.find(v => /^en/i.test(v.lang)) ||
    voices[0];
}
if ('speechSynthesis' in window) {
  pickVoice();
  window.speechSynthesis.onvoiceschanged = pickVoice;
}

function speak(text) {
  const clean = text.trim();
  if (!clean || !('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(clean);
  if (voice) u.voice = voice;
  u.rate = 1.0;
  u.pitch = 0.92;
  u.volume = 1.0;
  window.speechSynthesis.speak(u);
}

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onresult = (e) => {
    let interim = '', final = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) final += t;
      else interim += t;
    }
    if (interim) els.textInput.value = interim;
    if (final) els.textInput.value = final.trim();
  };
  recognition.onerror = (e) => {
    console.warn('Speech recognition error:', e.error);
    state.recognizing = false;
    els.micBtn.classList.remove('recording');
    setStatus('ONLINE', 'online');
  };
  recognition.onend = () => {
    if (state.recognizing) {
      state.recognizing = false;
      els.micBtn.classList.remove('recording');
      setStatus('ONLINE', 'online');
      const text = els.textInput.value.trim();
      if (text) send();
    }
  };
} else {
  els.micBtn.classList.add('hidden');
}

function startRecognition() {
  if (!recognition || state.recognizing || state.busy) return;
  try {
    window.speechSynthesis.cancel();
    els.textInput.value = '';
    recognition.start();
    state.recognizing = true;
    els.micBtn.classList.add('recording');
    setStatus('LISTENING', 'listening');
  } catch (e) {/* already running */}
}
function stopRecognition() {
  if (!recognition || !state.recognizing) return;
  try { recognition.stop(); } catch (e) {}
}

els.micBtn.addEventListener('mousedown', (e) => { e.preventDefault(); startRecognition(); });
els.micBtn.addEventListener('mouseup', (e) => { e.preventDefault(); stopRecognition(); });
els.micBtn.addEventListener('mouseleave', () => { if (state.recognizing) stopRecognition(); });
els.micBtn.addEventListener('touchstart', (e) => { e.preventDefault(); startRecognition(); });
els.micBtn.addEventListener('touchend', (e) => { e.preventDefault(); stopRecognition(); });

async function callJarvis(userText) {
  const apiKey = localStorage.getItem(STORAGE_KEY);
  if (!apiKey) {
    openSettings();
    return;
  }

  state.busy = true;
  els.sendBtn.disabled = true;
  state.history.push({ role: 'user', content: userText });
  if (state.history.length > 20) state.history = state.history.slice(-20);

  appendTurn('user', userText);
  const jarvisTurn = appendTurn('jarvis', '');
  jarvisTurn.classList.add('streaming');
  const jarvisText = jarvisTurn.querySelector('.text');
  setStatus('PROCESSING', 'thinking');
  els.reactor.classList.add('thinking');

  let assistantText = '';
  let speakBuffer = '';

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        stream: true,
        system: [
          { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
        ],
        messages: state.history,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      let errMsg = `Error ${res.status}`;
      try { errMsg = JSON.parse(errBody).error?.message || errMsg; } catch (e) {}
      if (res.status === 401) {
        jarvisText.textContent = `Sir, my credentials appear to be invalid.`;
        speak('Sir, my credentials appear to be invalid.');
        state.history.pop();
        setStatus('AUTH ERROR', 'error');
        openSettings();
      } else {
        jarvisText.textContent = `Apologies, sir — ${errMsg}`;
        speak('Apologies, sir. A momentary lapse.');
        state.history.pop();
        setStatus('ERROR', 'error');
      }
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const events = buffer.split('\n\n');
      buffer = events.pop();

      for (const evt of events) {
        const dataLine = evt.split('\n').find(l => l.startsWith('data: '));
        if (!dataLine) continue;
        try {
          const data = JSON.parse(dataLine.slice(6));
          if (data.type === 'content_block_delta' && data.delta?.type === 'text_delta') {
            const chunk = data.delta.text;
            assistantText += chunk;
            jarvisText.textContent = assistantText;
            els.transcript.scrollTop = els.transcript.scrollHeight;

            speakBuffer += chunk;
            let m;
            while ((m = speakBuffer.match(/^([\s\S]*?[.!?])(\s+|$)/))) {
              const sentence = m[1].trim();
              if (sentence) speak(sentence);
              speakBuffer = speakBuffer.slice(m[0].length);
            }
          }
        } catch (e) {/* skip */}
      }
    }

    if (speakBuffer.trim()) speak(speakBuffer.trim());
    state.history.push({ role: 'assistant', content: assistantText });
  } catch (err) {
    console.error(err);
    jarvisText.textContent = `Apologies, sir — the connection appears unstable.`;
    speak('Apologies, sir. The connection appears unstable.');
    state.history.pop();
    setStatus('CONNECTION LOST', 'error');
  } finally {
    state.busy = false;
    els.sendBtn.disabled = false;
    jarvisTurn.classList.remove('streaming');
    if (!els.statusDot.classList.contains('error')) {
      setStatus('ONLINE', 'online');
    }
    els.reactor.classList.remove('thinking');
  }
}

function send() {
  if (state.busy) return;
  const text = els.textInput.value.trim();
  if (!text) return;
  els.textInput.value = '';
  callJarvis(text);
}

els.sendBtn.addEventListener('click', send);
els.textInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    send();
  }
});

function init() {
  if (!localStorage.getItem(STORAGE_KEY)) {
    setStatus('STANDBY');
    setTimeout(openSettings, 500);
  } else {
    setStatus('ONLINE', 'online');
  }
}
init();
