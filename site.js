const installButton = document.querySelector('[data-install]');
const shareButton = document.querySelector('[data-share]');
const startGame = document.querySelector('[data-start-game]');
const dialog = document.querySelector('#site-dialog');
const dialogTitle = dialog.querySelector('#dialog-title');
const dialogText = dialog.querySelector('[data-dialog-text]');
const nativeInstall = dialog.querySelector('[data-native-install]');
const copyButton = dialog.querySelector('[data-copy]');
const copyField = dialog.querySelector('[data-copy-field]');
const copyInput = copyField.querySelector('input');
const status = dialog.querySelector('[role="status"]');
let installPrompt;
let installed = inStandaloneMode();

function track(event, props) {
  try {
    window.plausible?.(event, props ? { props } : undefined);
  } catch {
    // 统计服务异常时保持站内操作可用。
  }
}

function inStandaloneMode() {
  return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

function updateInstallInstructions() {
  const isAppleMobile = /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (/Mac/.test(navigator.platform) && navigator.maxTouchPoints > 1);
  nativeInstall.hidden = installed || !installPrompt;
  dialogText.textContent = installed
    ? 'This guide is already in app mode. You can copy the link to share it.'
    : installPrompt
      ? 'Install the guide for quick access from your device.'
      : isAppleMobile
        ? 'In Safari, use Share, then choose Add to Home Screen.'
        : 'Use your browser’s Install or Add to Home Screen option. If it is unavailable, bookmark the guide.';
}

function openDialog(mode) {
  dialog.dataset.mode = mode;
  status.textContent = '';
  copyField.hidden = true;
  dialogTitle.textContent = mode === 'install' ? 'Install App' : 'Share this guide';
  if (mode === 'install') {
    updateInstallInstructions();
  } else {
    nativeInstall.hidden = true;
    dialogText.textContent = 'Copy a link to the guide and send it to someone.';
  }
  if (!dialog.open) dialog.showModal();
}

startGame?.addEventListener('click', () => {
  const slot = startGame.parentElement;
  const embed = slot.querySelector('[data-game-embed]');
  const frame = embed.content.querySelector('iframe').cloneNode(true);
  slot.replaceChildren(frame);
  frame.focus();
}, { once: true });

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  if (typeof dialog.showModal !== 'function') return;
  installPrompt = event;
  track('PWA Install Available');
  if (dialog.open && dialog.dataset.mode === 'install') updateInstallInstructions();
});

window.addEventListener('appinstalled', () => {
  installed = true;
  installPrompt = undefined;
  if (dialog.open && dialog.dataset.mode === 'install') updateInstallInstructions();
  track('PWA Installed');
});

if (typeof dialog.showModal === 'function') {
  installButton.hidden = false;
  installButton.addEventListener('click', () => {
    track('PWA Install Click');
    if (installed || !installPrompt) track('PWA Install Help');
    openDialog('install');
  });

  nativeInstall.addEventListener('click', async () => {
    if (!installPrompt || installed) return;
    const prompt = installPrompt;
    installPrompt = undefined;
    nativeInstall.disabled = true;
    try {
      const choice = await prompt.prompt();
      const result = choice || await prompt.userChoice;
      track('PWA Install Result', { outcome: result?.outcome || 'unknown' });
      if (dialog.open && dialog.dataset.mode === 'install') {
        status.textContent = result?.outcome === 'accepted' ? 'Installation accepted.' : 'Installation closed.';
      }
    } catch {
      track('PWA Install Result', { outcome: 'unavailable' });
      if (dialog.open && dialog.dataset.mode === 'install') status.textContent = 'Use the browser menu to install.';
    } finally {
      nativeInstall.disabled = false;
      if (dialog.open && dialog.dataset.mode === 'install') updateInstallInstructions();
    }
  });

  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
  });

  copyButton.addEventListener('click', async () => {
    const url = new URL('/', location.href).href;
    try {
      await navigator.clipboard.writeText(url);
      if (!dialog.open) return;
      status.textContent = 'Guide link copied.';
      if (dialog.dataset.mode === 'install') track('PWA Link Copied');
    } catch {
      if (!dialog.open) return;
      copyInput.value = url;
      copyField.hidden = false;
      copyInput.focus();
      copyInput.select();
      status.textContent = 'Select and copy the link.';
    }
  });

  if (shareButton) {
    shareButton.hidden = false;
    shareButton.addEventListener('click', async () => {
      if (navigator.share) {
        try {
          await navigator.share({ title: 'Dig Out the Village Guide', url: new URL('/', location.href).href });
          return;
        } catch (error) {
          if (error.name === 'AbortError') return;
        }
      }
      openDialog('share');
    });
  }
}

for (const mount of document.querySelectorAll('[data-player]')) {
  const button = mount.querySelector('[data-load-video]');
  const id = mount.dataset.player;
  if (!/^[0-9A-Za-z_-]{11}$/.test(id)) continue;
  button.hidden = false;
  button.addEventListener('click', () => {
    const frame = document.createElement('iframe');
    frame.title = button.getAttribute('aria-label').replace('Load', 'YouTube player for');
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    frame.allowFullscreen = true;
    frame.src = new URL('/embed/' + id + '?autoplay=1', 'https://www.youtube-nocookie.com');
    mount.replaceChildren(frame);
    frame.focus();
  }, { once: true });
}

const tasks = Array.from(document.querySelectorAll('[data-task]'));
if (tasks.length) {
  const key = 'dig-out-the-village-checklist';
  const output = document.querySelector('[data-progress]');
  const message = document.querySelector('[data-check-message]');

  function showStorageStatus() {
    message.hidden = false;
    message.textContent = 'This browser could not save the checklist. You can still use it on this page.';
  }

  function updateProgress() {
    const checked = tasks.filter((field) => field.checked);
    output.value = checked.length + ' of ' + tasks.length;
    return checked.map((field) => field.value);
  }

  try {
    const previous = JSON.parse(localStorage.getItem(key) || '[]');
    if (Array.isArray(previous)) {
      for (const field of tasks) field.checked = previous.includes(field.value);
    }
  } catch (error) {
    if (!(error instanceof SyntaxError)) showStorageStatus();
  }

  updateProgress();
  for (const field of tasks) {
    field.addEventListener('change', () => {
      const selected = updateProgress();
      try {
        localStorage.setItem(key, JSON.stringify(selected));
        message.hidden = true;
      } catch {
        showStorageStatus();
      }
    });
  }
}

if (installed) {
  track('PWA Page View');
  try {
    if (!sessionStorage.getItem('village-pwa-session')) {
      sessionStorage.setItem('village-pwa-session', '1');
      track('PWA Session');
    }
  } catch {
    // 会话存储不可用时跳过会话去重事件。
  }
}

if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => track('PWA Service Worker Error'));
}
