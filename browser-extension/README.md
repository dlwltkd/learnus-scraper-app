# LearnUs Connect browser helper

This Manifest V3 extension transfers a completed `ys.learnus.org` SSO session to
LearnUs Connect. It does not collect usernames or passwords and does not automate the
Yonsei login form.

## User flow

1. Open the extension and select **Open LearnUs SSO**.
2. Complete Yonsei SSO in the normal LearnUs tab.
3. Open the extension again and select **Connect this browser**.
4. Continue in the LearnUs Connect tab opened by the extension.

The second click is intentional. The extension does not monitor browsing or upload a
LearnUs session in the background. **Connect this browser** sends the applicable cookies
to the LearnUs Connect server, where the session is retained for synchronization. The
popup links to the public [Privacy Policy](../docs/legal/privacy-policy.md) before that
action.

## Security boundary

- The only API permission is `cookies`.
- Production host access is limited to `https://ys.learnus.org/*` and
  `https://luconnect.dlwltkd.com/*`.
- There are no content scripts, injected scripts, navigation listeners, remote code,
  or access to Yonsei's SSO host.
- The service worker reads cookies applicable to `https://ys.learnus.org/my/`, including
  HttpOnly cookies, only after the user presses **Connect**.
- LearnUs cookie values remain in service-worker memory for one request. They are never sent to
  the popup, browser storage, or console.
- The endpoint is compiled into the extension. Popup messages cannot supply a URL.
- The server response may open only the configured completion origin and path, with one
  base64url ticket in the URL fragment.
- Before opening completion, the helper sets the ticket in a host-only, short-lived
  `Secure; HttpOnly; SameSite=Strict` cookie named `__Host-luconnect_login` on the service
  host. The API requires that cookie to match the ticket and clears it after completion.
  A copied link cannot sign another browser into the link sender's account. This uses
  the existing `cookies` permission; neither LearnUs cookies nor tickets enter
  `chrome.storage`.
- Reopening the popup during an exchange joins the pending attempt instead of uploading
  cookies again. A failed cookie write prevents the completion tab from opening.
- Incognito mode is disabled to avoid reading from or confusing separate cookie stores.

The backend necessarily retains the LearnUs session used by its synchronization workers;
that server-side retention is outside this extension package.

## Backend contract

Production sends one request:

```http
POST https://luconnect.dlwltkd.com/api/auth/extension/exchange
Content-Type: application/json
Cache-Control: no-store

{"cookies":"<Cookie header>"}
```

The successful response contains only a short-lived ticket and its lifetime, never an API
token or browser-session token:

```json
{
  "status": "success",
  "ticket": "<single-use-ticket>",
  "expires_in": 90
}
```

The extension validates the ticket and lifetime, constructs the completion URL from its
compiled origin and path, and places the ticket in that URL's fragment. It never follows a
server-provided redirect URL. The ticket must be random, single-use, expire within 30–300
seconds, and be exchanged by the web page for a host-only HttpOnly browser-session cookie.
The temporary login cookie shares the ticket's lifetime. A missing or mismatched cookie
rejects completion without consuming the ticket or changing an existing browser session.

Development uses `http://localhost:8000/auth/extension/exchange` and accepts a completion
page at `http://localhost:8081/auth/extension`. Localhost access is absent from the
production manifest and package. Development sets an HttpOnly `luconnect_login` cookie
through the permitted `http://localhost:8000/` URL with `Secure=false`; cookies are
host-scoped, so the same localhost browser can complete the flow at port 8081.

Version 0.1.1 is required for browser binding. Update/reload the helper before deploying
the API check: 0.1.1 can use the previous API, but the updated API rejects completion
from 0.1.0. Existing authenticated browser sessions are unaffected. See the
[deployment guide](../docs/deployment.md#browser-helper) for release coordination.

## Build and test

Node.js is the only project dependency. The packaging script creates deterministic ZIP
archives using Node's standard library.

```bash
cd browser-extension
npm test
npm run build:development
npm run build:production
```

Builds are written to ignored `dist/` directories, with store-ready archives at:

```text
dist/learnus-connect-development.zip
dist/learnus-connect-production.zip
```

To build an unpacked directory without creating an archive:

```bash
node package-extension.mjs development --no-zip
```

Load `dist/development/` from `chrome://extensions` or `edge://extensions` with Developer
mode enabled. The same production archive can be submitted to Chrome Web Store and Edge
Add-ons; store signing keys and generated `.pem` or `.crx` files must never be committed.

## Manual verification

- Test a fresh SSO login, an already authenticated session, cancelled SSO, and an expired
  session.
- Confirm no request occurs when **Open LearnUs SSO** is pressed.
- Confirm the popup explains server transfer and retention and its privacy-policy link
  opens without requesting another host permission.
- Confirm **Connect this browser** makes one POST only to the configured exchange URL.
- Inspect the extension service-worker console and storage; neither should contain cookie
  values, tickets, or API tokens.
- Confirm the completion ticket appears only in the URL fragment and disappears when the
  web app consumes it.
- Confirm a second attempt to consume the same ticket fails.
- Confirm production asks for no localhost, wildcard-host, tab, scripting, storage,
  navigation, or web-request permission.

Chrome should initially be tested with the exact `ys.learnus.org` host permission. Broaden
it only if a real SSO trace proves that a required parent-domain cookie is inaccessible.
