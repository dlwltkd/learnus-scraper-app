const openLoginButton = document.querySelector('#open-login');
const connectButton = document.querySelector('#connect-browser');
const status = document.querySelector('#status');

const ERROR_MESSAGES = Object.freeze({
  NO_SESSION: 'Finish signing in to LearnUs, then try again.',
  SESSION_REJECTED: 'LearnUs rejected this session. Sign in again and retry.',
  RATE_LIMITED: 'Too many attempts. Wait a moment and try again.',
  NETWORK: 'Could not reach LearnUs Connect. Check your network and retry.',
  TIMEOUT: 'The connection timed out. Please try again.',
  SERVER: 'LearnUs Connect is temporarily unavailable.',
  BAD_RESPONSE: 'The server returned an unexpected response.',
  INTERNAL: 'The extension could not finish signing in.',
  INVALID_ACTION: 'The extension could not start this action.',
  INVALID_SENDER: 'The extension rejected this request.',
});

function setBusy(isBusy) {
  openLoginButton.disabled = isBusy;
  connectButton.disabled = isBusy;
}

function setStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle('error', isError);
}

async function sendAction(type) {
  setBusy(true);
  setStatus('Working…');
  try {
    const result = await chrome.runtime.sendMessage({ type });
    if (!result?.ok) {
      setStatus(ERROR_MESSAGES[result?.code] ?? ERROR_MESSAGES.INTERNAL, true);
      return false;
    }
    return true;
  } catch {
    setStatus(ERROR_MESSAGES.INTERNAL, true);
    return false;
  } finally {
    setBusy(false);
  }
}

openLoginButton.addEventListener('click', async () => {
  if (await sendAction('OPEN_LOGIN')) {
    setStatus('Complete SSO in the LearnUs tab, then return here.');
  }
});

connectButton.addEventListener('click', async () => {
  if (await sendAction('CONNECT_BROWSER')) {
    setStatus('Connected. Continue in the LearnUs Connect tab.');
  }
});
