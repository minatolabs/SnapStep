
# SnapStep — Product Requirements Document (PRD)

*(Derived from SnapStep_Master_Handbook_2025-10-31.md as a dedicated, implementation-ready PRD.)*

---

## 1. Product Overview

**Product Name:** SnapStep  
**Owner:** MinatoLabs  
**Version:** MVP → v1 (Hosted beta, ≤30 users; self-hostable later)  
**Deployment Target:** Proxmox-backed Ubuntu 22.04 VM (single node), Docker-based stack

SnapStep turns real workflows performed on a Windows machine into **structured, redacted, annotated guides** that can be safely shared internally or externally.

### Core Concept

1. User presses **Record** on a Windows client.
2. Client captures steps (clicks, fields, context) plus screenshots with privacy protections.
3. When stopped, SnapStep opens a **web editor** where captured steps appear as a structured guide.
4. User edits, annotates, redacts, and exports/shares as a link or PDF.

### North Star Metric

- **Time-to-First-Share (TTFS)**: First-time user should record, edit, and share a guide in **≤ 5 minutes (p50)**.

---

## 2. Objectives & Success Metrics

### Primary Objectives

1. Reduce friction in creating high-quality, privacy-safe how-to documentation.
2. Ensure guides are polished and trustworthy for:
   - Internal runbooks and SOPs
   - Customer-facing workflows
   - Onboarding and training material

### Success Metrics

- TTFS ≤ 5 minutes (p50) for first-time users.
- Export completion time ≤ 30s (p95) for standard guides (6–20 steps).
- Crash-free Windows client sessions ≥ 99.5%.
- Hosted beta stable with **≤ 30 total accounts**, enforced via configuration.

---

## 3. Target Users & Use Cases

### Personas

1. **Ops / IT Professional**
   - Needs internal runbooks, repeatable steps, secure handling of credentials/PII/PHI.
   - Current pain: ad hoc screenshots, Word/Google Docs, missing steps, security risk.

2. **Trainer / Customer Support**
   - Needs polished walkthroughs with annotations and redactions for end users.

3. **Engineer / Builder**
   - Needs quick internal documentation of infra changes, deployments, and procedures.

### Representative Use Cases

- Document VPN onboarding for new hires.
- Capture EHR or line-of-business workflows **without exposing sensitive data**.
- Create support macros (“How to reset password in System X”).
- Build consistent runbooks for deployments, migrations, and rollback procedures.

---

## 4. Scope

### 4.1 In-Scope (MVP → v1 Hosted)

1. Windows desktop recorder client.
2. Web-based SnapStep editor.
3. Backend API + background workers.
4. Object and relational storage.
5. Authentication, roles, and tenancy.
6. Platform admin dashboard for hosted environment.
7. Single-node deployment on Ubuntu 22.04 via Docker/Docker Compose.

### 4.2 Out-of-Scope (MVP)

- macOS / Linux / mobile clients.
- Real-time multi-user collaborative editing (CRDT/Yjs-level collab).
- Enterprise SSO/SCIM (beyond basic OIDC).
- Third-party integrations (Jira, Zendesk, Confluence, etc.).
- Localization & multi-language support.
- Public community template marketplace.

These are future roadmap candidates, not accidental scope creep.

---

## 5. Functional Requirements

## 5.1 Windows Client Recorder

### Goals

- Capture user workflows accurately with low friction.
- Be privacy-safe by default and transparent (no stealth behavior).

### Requirements

**Installation & Updates**

- FR-CL-001: Provide signed installer (MSIX preferred).
- FR-CL-002: Support automatic updates with rollback capability.

**Authentication**

- FR-CL-003: Use device-code OAuth2/OIDC to authenticate against SnapStep backend.
- FR-CL-004: Store tokens securely (e.g., Windows Credential Manager).

**Capture Behavior**

- FR-CL-005: Log key user actions:
  - Clicks on interactive UI elements.
  - Focus changes (fields/windows).
  - Key high-signal events (submits, navigation, dialogs).
- FR-CL-006: Ignore noise:
  - Pure mouse movement.
  - Scroll spam unless explicitly configured.
- FR-CL-007: For each step, capture:
  - Target element context (label, aria/name where possible).
  - App/process name.
  - Window title.
  - Timestamp.
- FR-CL-008: Capture a **region screenshot** around the point of interaction with configurable padding.

**Privacy & Redaction**

- FR-CL-009: Do **not** store raw typed values. Store semantic hints only, e.g.:
  - “Password entered”
  - “Email typed (length=12)”
- FR-CL-010: Maintain a built-in denylist (password managers, banking apps, sensitive domains).
- FR-CL-011: Support per-tenant allow/deny rules from backend configuration.
- FR-CL-012: Provide a visible recording indicator at all times.

**Offline-First & Reliability**

- FR-CL-013: Queue all events and screenshots locally in a durable store (e.g., SQLite).
- FR-CL-014: Support exponential backoff and retry when offline/unavailable.
- FR-CL-015: On **Stop**, ensure:
  - All steps are persisted locally.
  - Upload session is initiated with backend.
  - Editor URL is opened once server confirms session.

**Uploads**

- FR-CL-016: Request presigned URLs for screenshots and assets.
- FR-CL-017: Upload directly to object storage; mark failed uploads for retry.

**UX**

- FR-CL-018: Provide tray icon with:
  - Start Recording
  - Pause/Resume
  - Stop & Open Editor
- FR-CL-019: Provide simple log/export for troubleshooting (no sensitive content).

---

## 5.2 Web Editor

### Purpose

Transform raw captures into polished, shareable, safe documentation.

### Requirements

**Guide Bootstrapping**

- FR-ED-001: When user opens the editor URL:
  - Load associated guide with pre-populated steps.
  - Each step includes:
    - Auto-generated title (from context).
    - Screenshot.
    - Placeholder description block.

**Content Model**

- Support rich blocks:
  - Headings (H1–H6)
  - Paragraphs
  - Bullet, numbered, and checklist lists
  - Callouts / info/warning blocks
  - Quotes
  - Code blocks with syntax highlighting
  - Tables
  - Horizontal rules
  - Inline and preview links

**Editing & Layout**

- FR-ED-002: Drag-and-drop steps and sections.
- FR-ED-003: Support substeps and collapsible sections.
- FR-ED-004: Basic version history:
  - At minimum: snapshots/checkpoints; detailed diff is a v1+ enhancement.

**Screenshot Annotation**

- FR-ED-010: Provide annotation tools:
  - Rectangles, circles.
  - Arrows and lines.
  - Text labels.
  - Blur/pixelate.
  - Freehand pen.
  - Crop/resize.
- FR-ED-011: Non-destructive editing:
  - Store annotations as overlay metadata.
  - Keep original image for revert and future exports.

**Autosave & Safety**

- FR-ED-020: Debounced autosave to backend.
- FR-ED-021: Local browser cache (e.g., IndexedDB) for temporary offline resilience.
- FR-ED-022: Indicate save status (Saving / Saved / Offline).

**Exports & Sharing**

- FR-ED-030: Export to **PDF**:
  - Clean layout optimized for step-based guides.
  - Include titles, text, images, annotations.
- FR-ED-031: Generate **view-only links**:
  - Optional expiration.
  - Access controlled per-tenant.
- FR-ED-032: Provide **copy as Markdown/HTML** (v1+ if capacity allows).

---

## 5.3 Backend API & Workers

### Responsibilities

- Manage sessions, guides, steps, auth, uploads, exports.
- Provide stable contracts for client and editor.

### Core Endpoints (illustrative, not exhaustive)

- `POST /v1/sessions`
- `POST /v1/sessions/{id}/complete`
- `POST /v1/steps`
- `POST /v1/uploads` (presigned URLs)
- `GET /v1/guides/{id}`
- `PATCH /v1/guides/{id}`
- `POST /v1/exports/pdf`
- `GET /v1/exports/{job_id}` (status)

### Workers

- Handle:
  - PDF generation.
  - Image processing (thumbnails, compression).
  - Optional OCR & text extraction (behind feature flag).
- Must:
  - Enforce concurrency limits.
  - Expose job status for UI polling.
  - Fail gracefully and retry with bounds.

---

## 5.4 Storage & Data Model

### Technologies

- **PostgreSQL** for relational data.
- **MinIO/S3-compatible storage** for images and binary assets.

### Key Entities (Simplified)

- Tenant / Organization
- User
- Membership (User ↔ Tenant)
- Session
- Guide
- Step
- Annotation
- Asset (screenshots/files)
- ExportJob
- AuditEvent
- FeatureFlag / TenantConfig

### Requirements

- All tenant-scoped entities include `tenant_id`.
- Enforce **Row-Level Security (RLS)** for strict tenant isolation.
- Partition or index larger tables by `tenant_id` and/or timestamps.
- Separate storage volumes for database vs. object storage.

---

## 5.5 Authentication, Tenancy & Roles

### Requirements

- Support OIDC-based login for web.
- Device code or similar for Windows client.
- Minimal roles:
  - **Owner**: full control over tenant.
  - **Admin**: manage users, configs.
  - **Editor**: create/edit guides.
  - **Viewer**: read-only.
- All API access scoped by:
  - `tenant_id`
  - user role
  - least-privilege principles.

---

## 5.6 Platform Admin Dashboard (Hosted Instance)

### Responsibilities

- Global controls for the hosted environment.

### Requirements

- Configure:
  - Signup mode: `open | invite_only | closed`.
  - Global `MAX_SIGNUPS_TOTAL` (default cap: 30).
  - Allowed and blocked email domains.
  - Per-tenant quotas (storage, guides, members).
  - Feature flags per tenant.
- Observe:
  - Total users, tenants.
  - DAU/WAU/MAU.
  - Guides/day, average steps/guide.
  - Export latency, error rates.
  - Storage usage by tenant.
- Audit:
  - Record all admin actions (who, what, when, before/after).

---

## 6. Non-Functional Requirements

### Security

- All endpoints behind HTTPS/TLS.
- No sensitive data in logs.
- Server-side secrets in environment/secret store; no hardcoded keys.
- Per-tenant isolation enforced at DB and app layer.
- Presigned URLs for object access with expiry.
- Documented threat model (STRIDE-style) with mitigations.

### Performance

- Editor load:
  - p50 ≤ 2s, p95 ≤ 4s (on typical guides).
- PDF export:
  - p95 ≤ 30s for standard workloads.

### Reliability

- Single-node MVP:
  - Documented backup & restore for DB and object storage.
- Aim for 99.9% uptime for hosted beta (best-effort with clear incident process).

### Scalability

- MVP tuned for ≤ 30 active users.
- No design choices that prevent:
  - Horizontally scaling API/worker nodes.
  - Moving object storage and DB to managed services later.

### Observability

- Structured JSON logging.
- Metrics:
  - Request latency.
  - Error rate.
  - Job queue depth.
  - Export success ratio.
- Dashboards for:
  - API.
  - Workers.
  - DB.
  - Object storage.
- Alerts for:
  - High error rates.
  - Backlog spikes.
  - Disk/storage thresholds.

### Accessibility

- Web editor aligned with WCAG 2.1 AA where practical:
  - Keyboard navigation.
  - Sufficient contrast.
  - Clear focus states.

---

## 7. Constraints & Assumptions

- Deployment: Ubuntu 22.04 LTS on Proxmox, Docker/Docker Compose.
- No Kubernetes required for MVP.
- Users are moderately technical.
- Hosted beta access tightly controlled (invite or pre-approved).

---

## 8. Release Plan (High-Level)

### Phase 0 — Inception

- Create repositories, environments, basic CI.
- Confirm architecture and constraints.

### Phase 1 — Definition

- Finalize PRD (this doc).
- Design API, data model, and client flows.

### Phase 2 — Walking Skeleton

- Auth working end-to-end.
- Minimal session:
  - Start capture → upload → view basic guide in editor.

### Phase 3 — MVP

- Stable Windows client.
- Editor with annotations and exports.
- Backend with workers & storage.
- Platform admin basics.
- Backup/restore and observability live.

### Phase 4 — Private Beta (≤ 30 users)

- Onboard selected tenants.
- Collect structured feedback.
- Tight bugfix loop.

### Phase 5 — v1.0

- Performance and reliability validated.
- Documentation complete:
  - Ops runbooks.
  - Tenant admin docs.
  - Security notes.
- Formalize licensing and pricing strategy.

---

## 9. Risks & Mitigations

1. **AV / EDR flagging the client**
   - Mitigation: signed binaries, transparent docs, minimal required permissions.

2. **Sensitive data leakage**
   - Mitigation: strict no-raw-input rule, denylist enforcement, strong redaction tooling.

3. **Scope creep (editor, AI, integrations)**
   - Mitigation: change control on PRD; new features gated behind review and flags.

4. **Performance issues for exports**
   - Mitigation: bounded worker concurrency, image optimization, job queue monitoring.

---

## 10. Open Questions

- Exact surface and default state for AI-assisted summaries or label suggestions.
- Client-side vs server-side split for PDF generation.
- Licensing strategy:
  - e.g., open core vs fully closed.
- Minimum Windows OS/version & EDR compatibility matrix.
- Policy for handling signup #31+ under global cap:
  - Hard block, waitlist, or manual approval mechanism.

---

*This PRD is intended to live in the SnapStep repo (e.g., `/docs/PRD.md`) as the single source of product truth for the MVP → v1 cycle.*
