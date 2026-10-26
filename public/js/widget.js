// ==============================================================================
// AI Automation Labs Live Chat Embed Widget (POC)
// ==============================================================================

export function initLiveChatWidget() {
  const launcher = document.getElementById('liveChatLauncher');
  const windowEl = document.getElementById('liveChatWindow');
  const closeBtn = document.getElementById('closeWidgetBtn');
  const sendBtn = document.getElementById('widgetSendBtn');
  const inputEl = document.getElementById('widgetInput');
  const messagesEl = document.getElementById('widgetMessages');

  if (!launcher || !windowEl) return;

  launcher.addEventListener('click', () => {
    windowEl.classList.toggle('open');
  });

  closeBtn?.addEventListener('click', () => {
    windowEl.classList.remove('open');
  });

  const sendMsg = () => {
    const text = (inputEl.value || '').trim();
    if (!text) return;

    // Append visitor message
    const msgDiv = document.createElement('div');
    msgDiv.style.alignSelf = 'flex-end';
    msgDiv.style.background = 'var(--brand-primary)';
    msgDiv.style.color = '#fff';
    msgDiv.style.padding = '8px 12px';
    msgDiv.style.borderRadius = '10px';
    msgDiv.style.fontSize = '0.84rem';
    msgDiv.style.maxWidth = '80%';
    msgDiv.textContent = text;
    messagesEl.appendChild(msgDiv);

    inputEl.value = '';
    messagesEl.scrollTop = messagesEl.scrollHeight;

    // Simulated automated greeting from live bot
    setTimeout(() => {
      const replyDiv = document.createElement('div');
      replyDiv.style.alignSelf = 'flex-start';
      replyDiv.style.background = 'rgba(255, 255, 255, 0.08)';
      replyDiv.style.padding = '8px 12px';
      replyDiv.style.borderRadius = '10px';
      replyDiv.style.fontSize = '0.84rem';
      replyDiv.style.maxWidth = '80%';
      replyDiv.textContent = '⚡ Thanks for reaching out to AI Automation Labs! A team specialist will respond momentarily.';
      messagesEl.appendChild(replyDiv);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }, 800);
  };

  sendBtn?.addEventListener('click', sendMsg);
  inputEl?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      sendMsg();
    }
  });
}
