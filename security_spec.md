# Security Specification — Report Navigator AI (Phase 0 TDD)

## 1. Data Invariants

1. **Default-Deny Catch-All**: Any path not explicitly matched is unconditionally denied (`allow read, write: if false;`).
2. **Verified Identity Gate**: Every write operation (`create`, `update`, `delete`) across all collections requires `request.auth != null && request.auth.token.email_verified == true`.
3. **Path Variable Hardening (ID Poisoning Guard)**: Every single-document operation (`get`, `create`, `update`, `delete`) validates all path IDs (`userId`, `docId`, `reportId`, `chunkId`, `questionId`) with `isValidId()`, enforcing `^[a-zA-Z0-9_\-]+$` and `.size() <= 128`.
4. **Master Gate Relational Sync**: Subcollections `/reports/{reportId}/chunks/{chunkId}` and `/reports/{reportId}/questions/{questionId}` verify parent existence (`exists()`) and parent ownership (`get(/databases/$(database)/documents/reports/$(reportId)).data.ownerId == request.auth.uid`) on every single-document read and write.
5. **PII Split Collection Isolation**: User email PII is isolated in `/users/{userId}/private/info` and is strictly readable and writable only when `request.auth.uid == userId`.
6. **Anti-Update-Gap & Action-Based Updates**: Every `allow update` block begins with the entity validation helper (`isValid[Entity](incoming())`), enforces immutability on `ownerId`, `reportId`, `uid`, and `createdAt`, enforces `incoming().updatedAt == request.time`, and restricts modified keys via named action branches using `incoming().diff(existing()).affectedKeys().hasOnly(...)`.
7. **Terminal State Locking**: Once a `ReportDocument` reaches `status == 'archived'`, all subsequent updates are rejected (`existing().status != 'archived'`).
8. **Secure List Queries (Query Enforcer)**: Every `allow list` rule enforces ownership directly on `resource.data.ownerId == request.auth.uid` without `get()`/`exists()` calls or client-side filter delegation.

---

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Payload 1 — Shadow Field Injection on Report Create**:
   - Path: `/reports/rep_01`
   - Attack: Includes valid fields plus `"isAdmin": true` ghost key.
   - Defense: Rejected by `data.keys().hasOnly(...)` in `isValidReportDocument`.
2. **Payload 2 — Unverified Email Spoof Write**:
   - Path: `/reports/rep_01`
   - Attack: Authenticated token with `email_verified: false` attempting `create`.
   - Defense: Rejected by `isVerifiedUser()` (`request.auth.token.email_verified == true`).
3. **Payload 3 — Cross-User Identity Spoofing (`ownerId` Mismatch)**:
   - Path: `/reports/rep_01`
   - Attack: User `uid_attacker` sets `ownerId: "uid_victim"` on `create`.
   - Defense: Rejected by `data.ownerId == request.auth.uid`.
4. **Payload 4 — Orphaned Subcollection Chunk Write**:
   - Path: `/reports/non_existent_report/chunks/chk_01`
   - Attack: Creating a chunk under a parent report that does not exist or belongs to another user.
   - Defense: Rejected by Master Gate `exists(...) && get(...).data.ownerId == request.auth.uid`.
5. **Payload 5 — Value Poisoning on Whitelisted Update Key**:
   - Path: `/reports/rep_01`
   - Attack: Updating whitelisted field `title` with an integer `99999` or a 10,000-character string.
   - Defense: Rejected because `isValidReportDocument(incoming())` wraps the entire `allow update` block.
6. **Payload 6 — Terminal State Bypass (`archived` -> `ready`)**:
   - Path: `/reports/rep_01`
   - Attack: Updating a report whose `existing().status == 'archived'` back to `'ready'`.
   - Defense: Rejected by terminal state lock `existing().status != 'archived'`.
7. **Payload 7 — Immortal Field Tampering (`createdAt` / `ownerId` Mutation)**:
   - Path: `/reports/rep_01`
   - Attack: Modifying `createdAt` or transferring `ownerId` during an update.
   - Defense: Rejected by `incoming().createdAt == existing().createdAt && incoming().ownerId == existing().ownerId`.
8. **Payload 8 — Forged Client Timestamp (`createdAt != request.time`)**:
   - Path: `/reports/rep_01`
   - Attack: Supplying a backdated or future `createdAt` timestamp on create.
   - Defense: Rejected by `incoming().createdAt == request.time`.
9. **Payload 9 — Path ID Poisoning (1.5KB Junk ID / Special Chars)**:
   - Path: `/reports/rep$bad!id`
   - Attack: Injecting non-alphanumeric or oversized document IDs.
   - Defense: Rejected by `isValidId(reportId)` regex `^[a-zA-Z0-9_\-]+$` and `size() <= 128`.
10. **Payload 10 — PII Lateral Read on `/users/{victimId}/private/info`**:
    - Path: `/users/uid_victim/private/info`
    - Attack: Authenticated user `uid_attacker` attempts `get` on another user's private email document.
    - Defense: Rejected by `request.auth.uid == userId`.
11. **Payload 11 — Unfiltered List Query Scraping on `/reports`**:
    - Path: `/reports`
    - Attack: Authenticated user runs an unconstrained `list` query without `where('ownerId', '==', request.auth.uid)`.
    - Defense: Rejected by `allow list: if isSignedIn() && resource.data.ownerId == request.auth.uid;`.
12. **Payload 12 — Unauthorized Chunk Mutation**:
    - Path: `/reports/rep_01/chunks/chk_01`
    - Attack: Attempting to `update` an indexed immutable RAG chunk with fabricated evidence text.
    - Defense: Rejected by `allow update: if false;` on immutable RAG chunks.

---

## 3. Red Team Audit & Conflict Report

- **Identity Spoofing**: Blocked on all collections (`data.ownerId == request.auth.uid` and `data.uid == request.auth.uid` plus `request.auth.token.email_verified == true`).
- **State Shortcutting**: Blocked on `/reports/{reportId}` via explicit action transitions (`processing -> ready`, `ready -> ready`, `ready -> archived`) and terminal state lock (`existing().status != 'archived'`).
- **Resource Poisoning**: Blocked via `isValidId()` on all path variables and explicit `.size()` bounds on every string and numeric range on every integer.
- **Value Poisoning**: Blocked because `isValid[Entity](incoming())` wraps every `allow create` and `allow update` rule prior to `affectedKeys().hasOnly(...)`.
- **PII Blanket Test**: Passed — `/users/{userId}/private/{docId}` is readable strictly by `request.auth.uid == userId`.
- **Query Trust Test**: Passed — all `allow list` rules enforce `resource.data.ownerId == request.auth.uid` with zero `get()` calls inside `list`.
