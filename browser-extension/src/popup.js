const openLoginButton = document.querySelector('#open-login');
const connectButton = document.querySelector('#connect-browser');
const status = document.querySelector('#status');

const ERROR_MESSAGES = Object.freeze({
  NO_SESSION: 'LearnUs 로그인이 필요해요. 같은 브라우저에서 로그인한 뒤 다시 연결해주세요.',
  SESSION_REJECTED: 'LearnUs 로그인이 만료됐어요. 다시 로그인한 뒤 연결해주세요.',
  RATE_LIMITED: '연결 요청이 많아요. 1분 뒤 다시 시도해주세요.',
  NETWORK: '서버에 연결하지 못했어요. 인터넷 연결을 확인한 뒤 다시 시도해주세요.',
  TIMEOUT: '연결 확인이 오래 걸리고 있어요. 잠시 후 다시 시도해주세요.',
  SERVER: '서버가 잠시 응답하지 않아요. 잠시 후 다시 시도해주세요.',
  BAD_RESPONSE: '연결 정보를 확인하지 못했어요. 확장 프로그램을 업데이트하고 다시 연결해주세요.',
  COOKIE_UNAVAILABLE: 'LearnUs Connect의 쿠키를 허용한 뒤 이 브라우저에서 다시 연결해주세요.',
  INTERNAL: '연결을 완료하지 못했어요. 확장 프로그램을 다시 열어 시도해주세요.',
  INVALID_ACTION: '요청을 시작하지 못했어요. 확장 프로그램을 다시 열어주세요.',
  INVALID_SENDER: '요청을 확인하지 못했어요. 확장 프로그램에서 다시 시도해주세요.',
});

function setBusy(isBusy, type) {
  openLoginButton.disabled = isBusy;
  connectButton.disabled = isBusy;
  openLoginButton.setAttribute('aria-busy', String(isBusy && type === 'OPEN_LOGIN'));
  connectButton.setAttribute('aria-busy', String(isBusy && type === 'CONNECT_BROWSER'));
}

function setStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle('error', isError);
}

async function sendAction(type) {
  setBusy(true, type);
  setStatus(type === 'CONNECT_BROWSER' ? 'LearnUs 로그인을 확인하고 있어요…' : 'LearnUs를 열고 있어요…');
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
    setStatus('LearnUs에서 로그인한 뒤 이 창을 다시 열고 “이 브라우저 연결”을 눌러주세요.');
  }
});

connectButton.addEventListener('click', async () => {
  if (await sendAction('CONNECT_BROWSER')) {
    setStatus('새로 열린 LearnUs Connect 탭에서 로그인을 마무리해주세요.');
  }
});
