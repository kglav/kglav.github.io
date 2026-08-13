(() => {
  const PASSWORD_HASH = '1b0199f044cc2e35e235d54c9067c5273180ee472f35e5288972640aa3b275cb';
  const STORAGE_KEY = 'keith-jah-site-unlocked-until';
  const REMEMBER_MS = 7 * 24 * 60 * 60 * 1000;

  const encodeHex = (buffer) => Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

  async function hashText(value) {
    const data = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return encodeHex(digest);
  }

  function isUnlocked() {
    const until = Number(localStorage.getItem(STORAGE_KEY) || 0);
    return Number.isFinite(until) && until > Date.now();
  }

  function rememberUnlock() {
    localStorage.setItem(STORAGE_KEY, String(Date.now() + REMEMBER_MS));
  }

  function lockSite() {
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  }

  function makeGate() {
    const gate = document.createElement('div');
    gate.className = 'site-auth-gate';
    gate.innerHTML = `
      <section class="site-auth-card" role="dialog" aria-modal="true" aria-labelledby="siteAuthTitle">
        <div class="site-auth-icon" aria-hidden="true">🔒</div>
        <p class="site-auth-kicker">Private preview</p>
        <h1 id="siteAuthTitle">Keith &amp; Jah's site</h1>
        <p class="site-auth-copy">Enter the shared password to continue.</p>
        <form class="site-auth-form" id="siteAuthForm">
          <label class="site-auth-field">
            <span>Password</span>
            <input id="siteAuthPassword" type="password" autocomplete="current-password" required autofocus>
          </label>
          <p class="site-auth-message" id="siteAuthMessage" aria-live="polite"></p>
          <button class="site-auth-button" type="submit">Open site</button>
        </form>
        <p class="site-auth-note">This is a lightweight privacy gate for the preview site, not high-security authentication.</p>
      </section>`;
    document.body.appendChild(gate);

    const form = gate.querySelector('#siteAuthForm');
    const input = gate.querySelector('#siteAuthPassword');
    const message = gate.querySelector('#siteAuthMessage');

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      message.textContent = '';
      const candidate = input.value;
      if (!candidate) return;

      const candidateHash = await hashText(candidate);
      if (candidateHash === PASSWORD_HASH) {
        rememberUnlock();
        document.documentElement.classList.remove('auth-pending');
        document.body.classList.remove('auth-locked');
        gate.remove();
        addLockButton();
        return;
      }

      input.value = '';
      input.focus();
      message.textContent = 'That password is not correct.';
      gate.classList.remove('site-auth-shake');
      void gate.offsetWidth;
      gate.classList.add('site-auth-shake');
    });
  }

  function addLockButton() {
    if (document.querySelector('.site-lock-button')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'site-lock-button';
    button.textContent = 'Lock';
    button.title = 'Lock this site on this browser';
    button.addEventListener('click', lockSite);
    document.body.appendChild(button);
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.documentElement.classList.remove('auth-pending');
    if (isUnlocked()) {
      addLockButton();
      return;
    }

    document.body.classList.add('auth-locked');
    makeGate();
  });
})();
