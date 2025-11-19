# SnapStep — Master Handbook (Consolidated)
_Date:_ 2025-10-31  
_Owner:_ MinatoLabs PMO  
_Status:_ Working Draft (MVP → v1)

---

## Table of Contents
1. [Executive Summary](#1-executive-summary)
2. [Project Charter[[Project Charter Checklist]]](#2-project-charter)
3. [Product Scope & Requirements (PRD)[[PRD]]](#3-product-scope--requirements-prd)
4. [Software Requirements Specification (SRS)[[SRS]]](#4-software-requirements-specification-srs)
5. [System Design[[C4-Containers]]](#5-system-design)[[C4-Context[[ERD]]]][[Sequence-Record-Upload-Edit]]
6. [Windows Client Design](#6-windows-client-design)
7. [Web Editor Feature Spec](#7-web-editor-feature-spec)
8. [Security & Privacy Pack[[Incident-Response]]](#8-security--privacy-pack)[[Threat-Model (STRIDE)]]
9. [Deployment on Proxmox (Ubuntu VM) & Single-Node Plan[[UAT]]](#9-deployment-on-proxmox-ubuntu-vm--single-node-plan)
10. [Platform Admin Dashboard](#10-platform-admin-dashboard)
11. [QA Strategy & Test Plan](#11-qa-strategy--test-plan)
12. [UAT Plan[[UAT]]](#12-uat-plan)
	1. [DevOps Runbooks[[backup_restore[[capacity]]
13. [Observability Plan (SLIs/SLOs, Dashboards, Alerts)](#14-observability-plan-slisslos-dashboards-alerts)
14. [Legal & Licensing](#15-legal--licensing)
15. [OSS Publishing Pack (GitHub)](#16-oss-publishing-pack-github)
16. [Governance & Team Rules](#17-governance--team-rules)
17. [Scope-Creep Guardrails](#18-scope-creep-guardrails)
18. [Stage-Gate Checklist](#19-stage-gate-checklist)
19. [Risk Register](#20-risk-register)
20. [Roadmap[[Release-Plan]]](#21-roadmap)
21. [Templates (ADR, Change Request, Test Case)](#22-templates-adr-change-request-test-case)
22. [Appendix A — API Contracts (Abridged OpenAPI)](#23-appendix-a--api-contracts-abridged-openapi)
23. [Appendix B — Data Model (ERD Overview)](#24-appendix-b--data-model-erd-overview)
24. [Appendix C — Environment & Configuration](#25-appendix-c--environment--configuration)
25. [Appendix D — Directory Layouts](#26-appendix-d--directory-layouts)
26. [Appendix E — Quick Index of Topics](#27-appendix-e--quick-index-of-topics)

---

## 1. Executive Summary
SnapStep converts real desktop/browser workflows into shareable, privacy-safe guides with annotated screenshots and rich text. It uses a **server–client model**: a Windows client records steps and screenshots; a web editor at `snapstep.minatolabs.com` provides Notion/Affine-level authoring, annotation, and export. Initial hosting is on a Proxmox-backed Ubuntu VM. Public signups are capped at **30** during beta.

**North Star Metric:** Time-to-first-share (TTFS) ≤ **5 minutes** for a first-time user.

**Primary deliverables:**
- Windows client (Python, optional native helper) with masked inputs and region screenshots.
- Backend (FastAPI/Nest), Postgres (RLS), Redis, Workers, S3/MinIO storage.
- Web editor (Next.js + TipTap; Konva/Fabric annotations), PDF export.
- Platform Admin Dashboard (signup caps, invites, usage & traffic metrics, audit log).
- Self-hostable stack (Docker Compose) for OSS tier later.

---

## 2. Project Charter
**Elevator Pitch:** Press Record. Do the task. Get a redacted, versioned guide you can share in minutes.  
**Sponsor:** UV (MinatoLabs) · **PM:** MinatoLabs PMO

**Goals & Metrics**
- TTFS ≤ 5 min (p50); export p95 ≤ 30s; crash-free sessions ≥ 99.5%.
- Beta capped at 30 signups; DAU/WAU tracked.

**Scope (MVP In):** Windows client, web editor, presigned uploads, PDF export, admin dashboard, single-node deploy.  
**Scope (MVP Out):** macOS/Linux clients, realtime co-editing (CRDT), SCIM, mobile capture.

**Assumptions:** Proxmox host (Ryzen 5 5600G/GT, 64GB RAM, ~30TB); Ubuntu 22.04 VM (8 vCPU, 24GB RAM recommended).  
**Risks (Top-3):** Python hooks flagged by AV; PII in screenshots; editor scope creep.

**Milestones:** Inception → Definition → Spike → Build (MVP) → Beta (30 users) → v1.

**Charter Checklist**
- Name/pitch; Goals & metrics; Scope in/out; Constraints; Budget; Milestones; Top risks; RACI; Approvals.

---

## 3. Product Scope & Requirements (PRD)
### 3.1 Vision & Personas
- **Ops/IT Pro:** documents admin procedures; needs redaction, versioning, team sharing.
- **Trainer/Support:** creates customer-facing walkthroughs; needs clean annotations + PDF.
- **Engineer:** captures internal runbooks.

### 3.2 In Scope (MVP → v1)
- Windows client (Python + optional native helper): clicks/typing/select, region screenshots, masked inputs, allow/deny capture lists, local queue, device-code sign-in.
- Web editor (TipTap blocks; Konva/Fabric annotations): headings, lists, rich formatting, tables, images/files/links, version history, autosave, comments/annotations on screenshots.
- Backend: FastAPI/Nest; Postgres (RLS); Redis; S3/MinIO; Workers for thumbnails/PDF/OCR (OCR optional feature-flag).
- Tiers: Consumer (hosted), Business (hosted, multi-user), OSS (self-host via Docker).

### 3.3 Explicitly Out (MVP)
- macOS/Linux clients; mobile; SCIM; audit integrations; CRDT/realtime co-edit; multi-language localization.

### 3.4 Acceptance Tests (MVP)
- Record a 6–12 step workflow → editor auto-populates; two redactions; reorder steps; export PDF matches viewer; share link works; no typed secrets stored.

### 3.5 Functional Requirements (Highlights)
- **Client:** capture click/type/select; UIAutomation labels; region screenshots; local queue; presigned uploads; open editor upon finish; deny/allow lists; auto-update.
- **API:** create session; presign upload; append step; complete session→guide; guides CRUD; annotations; exports; comments; audit (Business).
- **Editor:** TipTap blocks (H1–H6, lists, checklists, bold/italic/underline/strike/code, color/highlight, quotes, callouts, dividers, code blocks); tables; images/files/links; drag & drop; collapsible sections; nested pages; comments/annotations; autosave; version history.
- **Annotation:** rectangles/circles/arrows/lines; text boxes; pen; blur/pixelate; crop/resize; non-destructive overlays + derived bitmaps.
- **Auth/Tenancy:** OIDC (email/Google/GitHub; SAML/OIDC later), device-code for client; RBAC (Owner/Admin/Editor/Viewer) with Postgres RLS.
- **Admin:** signup modes; caps; invites; domain allow/deny; per-tenant flags; usage & traffic metrics; audit.

### 3.6 Non-Functional Requirements (Targets)
- Security: TLS; SSE/KMS; RLS; **no PII in logs**; mask typed values at source.
- Performance: editor TTI ≤ 2s (p50)/≤4s (p95); export p95 ≤ 30s.
- Reliability: availability ≥ 99.9% (hosted); backup/restore documented.
- Scalability: 200 steps/guide; 4K images; 10k DAU path; workers throttle heavy jobs.
- Accessibility: WCAG 2.1 AA for web.

---

## 4. Software Requirements Specification (SRS)
Formal, testable requirements referenced by IDs (maps to QA).

**Functional (sample IDs)**  
- FR-CL-001 Installable Windows app (MSIX/PyInstaller).  
- FR-CL-002 Device-code sign-in; tokens in Credential Manager.  
- FR-CL-003 Capture click/type/select; coalesce noise (double-click, scroll-only).  
- FR-CL-004 UIAutomation labels; optional browser companion for DOM labels.  
- FR-CL-005 Region screenshots; PNG originals.  
- FR-CL-006 Mask typed values at source.  
- FR-CL-007 SQLite queue; exponential backoff; survives reboots.  
- FR-CL-008 Presigned PUT uploads; step metadata POST.  
- FR-CL-009 Stop→open editor URL.  
- FR-CL-010 Allow/deny capture lists.  
- FR-API-001 Create session; FR-API-002 Presign; FR-API-003 Append step; FR-API-004 Complete session; FR-API-005 Guides CRUD; FR-API-009 Exports (PDF).  
- FR-ED-xxx Editor blocks; non-destructive annotations; version history.  
- FR-AU/TEN-xxx Auth, tenancy, RBAC.  
- FR-ADM-xxx Admin controls & metrics.

**Non-Functional**  
- Security (TLS, KMS/SSE, RLS), Performance (TTI/export), Reliability (backups), A11y, Observability.  

**Traceability Matrix:** Req ↔ Test Cases ↔ Jira (maintained in QA system).

---

## 5. System Design
### 5.1 Architecture (Container view)
- **Windows Client:** Python orchestrator; optional native helper for hooks/UIA; region screenshots (PNG).  
- **API/Workers:** FastAPI/Nest; Redis queue; thumbnail & PDF jobs; OCR optional.  
- **Storage:** Postgres (RLS), S3/MinIO for images, CDN in front as needed.  
- **Web Editor:** Next.js + TipTap; Konva/Fabric for annotations; viewer pages are cacheable.  
- **Proxy:** Caddy/Nginx Proxy Manager with ACME.

### 5.2 Core Sequences
**Record → Upload → Edit**
1) `POST /v1/sessions` → `session_id`, upload prefix.  
2) `POST /v1/uploads` → presigned URL.  
3) `PUT` image to S3/MinIO.  
4) `POST /v1/steps` with `screenshot_key`.  
5) `POST /v1/sessions/<built-in function id>/complete` → `guide_id`, `editor_url`.  
6) Browser opens editor.

**Export PDF**  
`POST /v1/exports/pdf` → job queued → worker renders → signed URL on ready.

### 5.3 Data Model (overview)
`tenants, orgs, users, org_members, sessions, guides, steps, annotations, assets, comments, audit, events, tenant_stats` with RLS keyed by `tenant_id`.

---

## 6. Windows Client Design
- Install: MSIX preferred; PyInstaller fallback; auto-update channel.  
- Sign-in: OAuth 2.0 device-code; tokens in Windows Credential Manager.  
- Capture: hooks gather click/type/select; coalesce noise; label via UIAutomation; region screenshot around target bounding box with padding; PNG originals.  
- Privacy: **never transmit raw typed values** (store type & length).  
- Offline-first: SQLite queue with retries; network loss tolerant.  
- Uploads: presigned PUT to object store; step POST to API.  
- Policies: allow/deny lists by process/domain; block password managers/banking/EHR by default; tenant overrides.  
- UX: Stop opens editor URL; logs are local & redacted; exportable bundle for support.

---

## 7. Web Editor Feature Spec
**Blocks:** H1–H6, paragraphs, bullet/numbered/checklist lists, quotes, callouts, dividers, code blocks (Prism).  
**Marks:** bold, italic, underline, strikethrough, code, font size, color, highlight.  
**Rich Content:** emoji, images (upload/resize/caption), files, links (inline + preview cards).  
**Advanced:** drag-and-drop blocks, collapsible sections, nested pages, comments/annotations on screenshots, autosave (IndexedDB) + debounced server save, version history UI, optional AI assists (feature-flag).  
**Screenshot Editing:** rectangles/circles/arrows/lines, text boxes, pen, blur/pixelate, crop/resize; store overlays as JSON; render preview bitmaps; keep originals for revert.

---

## 8. Security & Privacy Pack
**Threat Model (STRIDE)**  
- Spoofing: OIDC device-code, JWT validation, signed URLs.  
- Tampering: TLS, checksums, immutable versions.  
- Repudiation: admin audit log.  
- Info Disclosure: denylist capture, client-side masking, signed GET, RLS.  
- DoS: rate limits (signup/presign), worker backpressure.  
- Elevation: RBAC with least privilege.

**Data Handling**  
- Mask typed values at source; no PII in logs; redact log fields by schema.  
- Retention policies per tenant; default private guides; watermark exports (Business).

**Incident Response (summary)**  
Detect → Triage → Contain (disable heavy features) → Eradicate → Recover → Blameless postmortem with action items.

---

## 9. Deployment on Proxmox (Ubuntu VM) & Single-Node Plan
**Host:** Ryzen 5 5600G/GT, 64 GB RAM, ~30 TB (Proxmox).  
**VM:** Ubuntu 22.04, **8 vCPU / 24 GB RAM** recommended.

**Disks (separate):**  
- 100 GB system `/`  
- 200–300 GB Postgres `/srv/snapstep/postgres` (SSD/NVMe)  
- 4–10 TB MinIO `/srv/snapstep/minio` (HDD)

**Networking & TLS:** Caddy or NPM; UFW allow 80/443 only; MinIO bound locally; Cloudflare optional. DNS: `snapstep`, `api.snapstep`, `s3.snapstep`.

**Docker Compose Services:** proxy, postgres, redis, minio, api, worker, web (+ grafana/prometheus/loki/promtail optional).  
**Resource caps:** worker concurrency=2; mem limits so containers ≤ ~18 GB combined; editor images thumbnail to ≤2560px; WebP previews.

**Backups:** Proxmox `vzdump` + nightly `pg_dump`; `rclone` MinIO to secondary storage.  
**Monitoring:** Prometheus+Grafana; cAdvisor; Node Exporter; Loki/ELK; alerts (disk>85%, 5xx>1% 5m, job failures).

**Signup Cap (beta):** `SIGNUP_MODE=invite_only`, `MAX_SIGNUPS_TOTAL=30`, rate-limit signups; optional domain allowlist.

---

## 10. Platform Admin Dashboard
**Controls:** signup mode (open/invite/closed), `MAX_SIGNUPS_TOTAL`, invite codes, domain allow/deny lists, per-tenant flags (features/quotas).  
**Metrics:** daily signups; DAU/WAU/MAU; guides/day; steps/guide; redactions/guide; storage per tenant; export latency p50/p95; traffic RPS, p95 latency, 4xx/5xx.  
**Audit:** all admin actions with actor, subject, diff, timestamp.  
**Access:** `admin.snapstep.minatolabs.com`; PlatformAdmin role; optional IP allowlist.

**Admin APIs (examples):**  
- `GET /admin/overview`  
- `GET/POST /admin/settings/signup`  
- `GET/POST /admin/invites`  
- `GET /admin/tenants`, `POST /admin/tenants`, `PATCH /admin/tenants/:id`  
- `GET /admin/usage/tenants`, `GET /admin/usage/traffic`

---

## 11. QA Strategy & Test Plan
- **Pyramid:** unit → integration → e2e (Playwright).  
- **Environments:** dev/stage/prod with feature flags.  
- **A11y:** checks on editor/viewer.  
- **Performance:** export and editor TTI tests against SLOs.  
- **Release Acceptance:** checklist per release; smoke tests; rollback rehearsal.  
- **Bug SLAs:** severity-based triage & fix windows.

---

## 12. UAT Plan
**Entry:** MVP feature-complete; critical bugs resolved.  
**Scenarios:** record/edit/export for Ops/IT/Trainer personas; TTFS measured.  
**Exit:** ≥90% pass; critical issues resolved; docs updated.

---

## 13. DevOps Runbooks
- **Deploy:** blue/green with Compose profiles; health checks; post-deploy verification.  
- **Upgrade:** VM snapshot; `pg_dump`; drain workers; apply migrations; smoke tests.  
- **Backup/Restore:** nightly `pg_dump`, weekly base backup, MinIO rclone; quarterly restore drill.  
- **Incident:** detect, classify, throttle workers, disable heavy features, RCA/postmortem.  
- **Capacity:** track storage/CPU/RAM/queue depth; scale worker concurrency conservatively.  
- **TLS Rotation:** ACME auto-renew; manual fallback documented.

---

## 14. Observability Plan (SLIs/SLOs, Dashboards, Alerts)
**SLIs/SLOs:** editor TTI (p50/p95), export latency (p50/p95), 5xx rate, worker failures.  
**Dashboards:** API health; Workers; DB health; Storage (MinIO); Host/VM.  
**Alerts:** disk >85%; 5xx >1% for 5m; export job failures; slow endpoints (top N).  
**Logs:** JSON structured; **no PII**; index common fields (route, status, tenant).

---

## 15. Legal & Licensing
- **Licensing:** recommend **AGPL-3.0** for server; **Apache-2.0** (or proprietary) for client until v1. Confirm with counsel.  
- **Hosted Legal:** publish ToS & Privacy Policy even for beta.  
- **DPA Template:** for Business tenants later.  
- **Third-Party Notices:** keep a generated list.

---

## 16. OSS Publishing Pack (GitHub)
- **README.md:** features, architecture, quick start, security, roadmap.  
- **CONTRIBUTING.md:** local dev, branching, tests, ADRs.  
- **CODE_OF_CONDUCT.md**, **SECURITY.md**, **SUPPORT.md**.  
- **.github/** issue templates (bug/feature), PR template, CODEOWNERS.  
- **CHANGELOG.md:** Keep a Changelog; SemVer.

---

## 17. Governance & Team Rules
- **Delivery:** trunk-based; Conventional Commits; SemVer; code reviews (1–2 LGTMs).  
- **Definition of Ready:** story, acceptance tests, design notes, perf/security notes.  
- **Definition of Done:** tests green; docs updated; dashboards & flags wired; runbook delta captured.  
- **ADRs:** 1-page for decisions affecting deploy, data, or security.  
- **Interface Stability:** OpenAPI is the contract; deprecate before breaking.

---

## 18. Scope-Creep Guardrails
- Living **In/Out list** at top of PRD.  
- **Time-boxed spikes** prove feasibility before scope lands.  
- **Capacity Ledger** (team-weeks) to force trade-offs.  
- **Change Requests:** use CR template; PM triage weekly.

---

## 19. Stage-Gate Checklist
**Phase 0 Inception:** Charter approved; scope/budget; risk top-10; repos/CI skeleton.  
**Phase 1 Definition:** PRD v1; personas/JTBD; acceptance outline → SRS v1; C4; OpenAPI stub; Security draft.  
**Phase 2 Spike:** walking skeleton (auth → session → upload → editor). ADRs logged.  
**Phase 3 Build (MVP):** acceptance passes; observability live; runbooks; backup/restore validated.  
**Phase 4 Beta (30 users):** UAT pass; admin metrics live; security review complete.  
**Phase 5 v1:** SLOs met 2 weeks; incident drill done; roadmap v1.1 approved.

---

## 20. Risk Register
| Risk | Likelihood | Impact | Owner | Mitigation | Trigger | Status |
|---|---|---|---|---|---|---|
| Python hooks flagged by AV | Med | High | Eng | Native helper + code signing | AV false positives | Open |
| PII in screenshots | Med | High | PM/Sec | Default private, denylist, client redaction | UAT feedback | Open |
| PDF/OCR CPU spikes | Med | Med | Infra | Worker concurrency cap, queue backpressure | Queue depth high | Open |
| Editor scope creep | High | Med | PM | Feature flags, CRs, roadmap trade-offs | Mid-sprint asks | Open |

---

## 21. Roadmap (Now / Next / Later)
- **Now:** Admin settings + counters; auth/session/steps; editor skeleton; PDF export.  
- **Next:** Full annotations; Business RBAC; observability dashboards.  
- **Later:** OSS release; OCR assist; AI text polish; realtime co-edit.

---

## 22. Templates (ADR, Change Request, Test Case)
**ADR (1-pager)**  
```
Title / ID / Date
Decision (one paragraph)
Status: Proposed/Accepted/Rejected
Context
Options considered
Consequences
```

**Change Request (CR)**  
```
Summary
Rationale
Alternatives
Estimate (team-days)
Risks
Impact (timeline/cost)
Decision (Approved/Deferred/Rejected)
```

**Test Case**  
```
Req ID
Scenario
Steps
Expected
Data
Notes
```

---

## 23. Appendix A — API Contracts (Abridged OpenAPI)
```yaml
openapi: 3.0.3
info:
  title: SnapStep API
  version: 0.1.0
paths:
  /v1/sessions:
    post:
      summary: Create session
  /v1/uploads:
    post:
      summary: Presign upload
  /v1/steps:
    post:
      summary: Append step
  /v1/sessions/<built-in function id>/complete:
    post:
      summary: Complete session
  /v1/guides/<built-in function id>:
    get:
      summary: Get guide
    patch:
      summary: Update guide
  /v1/annotations:
    post:
      summary: Create annotation
    delete:
      summary: Delete annotation
  /v1/exports/pdf:
    post:
      summary: Request PDF export
  /admin/overview:
    get:
      summary: Admin counters & graphs
```

---

## 24. Appendix B — Data Model (ERD Overview)
Tables: `tenants, orgs, users, org_members, sessions, guides, steps, annotations, assets, comments, audit, events, tenant_stats`  
RLS on `tenant_id`. Indexes: `steps(guide_id,index)`, `assets(guide_id)`, `audit(tenant_id,at)`.

---

## 25. Appendix C — Environment & Configuration
**Signup Controls**  
- `SIGNUP_MODE=open|invite_only|closed`  
- `MAX_SIGNUPS_TOTAL=30`  
- `ALLOWED_EMAIL_DOMAINS`, `BLOCKED_EMAIL_DOMAINS`  
- `REQUIRE_INVITE_CODE=true`, `INVITE_CODE_LENGTH=12`

**S3/MinIO**  
- `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`

**DB/Redis**  
- `DATABASE_URL` (Postgres), `REDIS_URL`

**Auth/OIDC**  
- `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, device-code enabled

**Workers**  
- `WORKER_CONCURRENCY=2`, image max dims for thumbnails

---

## 26. Appendix D — Directory Layouts
**Server VM**  
```
/srv/snapstep/
  env/  compose/  postgres/  minio/  redis/
  api/  web/  worker/  proxy/
  backups/  logs/
```

**Repos**  
```
snapstep-api/    snapstep-web/    snapstep-worker/
snapstep-client-win/             infra/
```

---

## 27. Appendix E — Quick Index of Topics
- **Admin Dashboard:** §10  
- **Annotations:** §7  
- **API Contracts:** §23  
- **Backups:** §13 (Backup/Restore), §9  
- **Beta signup cap:** §9, §10, §25  
- **Client capture & masking:** §6, §8  
- **Data model:** §24  
- **Deployment:** §9, §26  
- **Editor features:** §7  
- **Legal/Licensing:** §15  
- **Observability:** §14  
- **Proxmox VM sizing:** §9  
- **Roadmap:** §21  
- **Runbooks:** §13  
- **Security/Privacy:** §8  
- **SRS/PRD:** §3–§4  
- **Templates:** §22

---

_This document consolidates the PM pack, scope, design, security, deployment, and publishing guidance so it can be read linearly without switching files._
