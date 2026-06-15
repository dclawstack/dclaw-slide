# Consensus Bug Report — dclaw-slide

**Auditors:** opus-4.8 + sonnet-4.6 (independent) · reconciled by opus-4.8.
**Confirmed by both models: 7** · Opus: 10 · Sonnet: 15

## 🔴 Confirmed bugs (found by both models)

#### 1. 🟧 [HIGH/security] Permissive CORS wildcard with allow_credentials=True
- **Location:** `backend/app/api/main.py:64`
- **Problem:** allow_origins=['*'] combined with allow_credentials=True is an invalid/insecure CORS configuration. Browsers reject wildcard+credentials, and frameworks that echo Origin back effectively allow any site credentialed cross-origin requests, enabling CSRF-style data theft.
- **Fix:** Set explicit allowed origins from config, or disable allow_credentials when using wildcard origins.

#### 2. 🟧 [HIGH/resource] SSE generator uses request-scoped DB session after route returns
- **Location:** `backend/app/api/v1/ai.py:206`
- **Problem:** The event_stream async generator calls db.add/commit/refresh on the request-scoped AsyncSession from Depends(get_db). FastAPI tears down the session when the route returns, but StreamingResponse consumes the generator lazily afterward, so DB operations run on a closed/finalized session causing SQLAlchemy errors or data loss.
- **Fix:** Open a fresh AsyncSession inside event_stream (via the sessionmaker/async context manager) instead of reusing the request-scoped db.

#### 3. 🟧 [HIGH/security] Empty share-link password grants access for any supplied password
- **Location:** `backend/app/api/v1/share.py:125`
- **Problem:** When a share link has no password (password_hash is empty), verify_password returns True for ANY input. hash_password('') returns '' so a no-password link is indistinguishable from one whose password was cleared, and the API silently ignores a supplied password, potentially leaving operators believing a link is protected when it is not.
- **Fix:** Track has_password explicitly (boolean column), treat empty hash as intentionally public and document it, and require non-empty passwords where protection is intended.

#### 4. 🟨 [MEDIUM/security] HTML/PDF export injects unsanitized theme_accent into CSS
- **Location:** `backend/app/services/export.py:94`
- **Problem:** presentation.theme_accent is interpolated directly into the HTML <style> block without escaping or validation. Since theme/brand colors can be user-controllable, this enables CSS/HTML injection into the exported document.
- **Fix:** Validate theme_accent against a strict color regex (e.g. ^#[0-9A-Fa-f]{3,8}$) or html.escape it before interpolation.

#### 5. 🟨 [MEDIUM/concurrency] RoomManager broadcast/presence reads and dead-connection cleanup race without lock
- **Location:** `backend/app/services/realtime.py:69`
- **Problem:** _broadcast and _presence read/mutate self._rooms without holding self._lock while join/leave mutate under the lock. Concurrent mutation during iteration in _presence (live dict) or dead-connection pop in _broadcast can cause RuntimeError or double-deletion/missed-connection races.
- **Fix:** Snapshot room/values under the lock before broadcasting and perform dead-connection cleanup while holding the lock.

#### 6. ⬜ [LOW/correctness] Analytics completion_rate can exceed 1.0 due to multiple finish events per session
- **Location:** `backend/app/api/v1/analytics.py:127`
- **Problem:** completion = finishes / len(sessions) counts all finish events; a session emitting multiple finish events makes completion_rate exceed 1.0, violating the documented 0..1 range.
- **Fix:** Count distinct sessions with at least one finish event: len({e.session_id for e in events if e.event_type=='finish'})/len(sessions).

#### 7. ⬜ [LOW/correctness] _parse_llm_json bracket-matching fails on valid JSON
- **Location:** `backend/app/services/ai/providers.py:336`
- **Problem:** The fallback bracket-matching loop in _parse_llm_json mishandles JSON extraction: it counts braces without accounting for string literals, and on a JSONDecodeError the inner break combined with depth==0 outer break prevents scanning later valid JSON. Both cause valid responses to fail to parse.
- **Fix:** Use a proper JSON scanner (json.JSONDecoder().raw_decode()) accounting for string escaping, and continue scanning to the next opening char on failure instead of breaking the outer loop.

