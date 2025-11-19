
# SnapStep MVP
For the MVP, I am building a single, reliable end-to-end flow.

I want a new user to be able to sign in, record a workflow on their Windows machine, automatically generate a step-by-step guide from that recording, make quick edits and basic annotations in the browser, and export or share that guide — all in a few minutes, without training, while respecting strict privacy constraints.

To make that real, my MVP includes:

## 1. Windows Recorder

- I provide a lightweight Windows tray app with a signed installer.
- The app lets the user:
  - Sign in,
  - Start recording,
  - Stop recording,
  - Always see a clear “recording” indicator.
- During recording, I capture meaningful actions:
  - Clicks on interactive elements.
  - Key UI transitions and navigation events.
  - One screenshot per step with basic context (window title, app name).
- I never store raw typed values like passwords or full form contents.
  - Instead, I store safe semantic markers such as:
    - “Password entered”
    - “Email typed”
- When the user stops recording:
  - I finalize the session,
  - Upload steps and screenshots to the backend,
  - Open the generated guide in the browser.

## 2. Backend & Storage

- I run a simple API + worker stack on a single Ubuntu 22.04 server using Docker.
- I use:
  - PostgreSQL for users, tenants, sessions, guides, steps, and configs.
  - S3-compatible object storage (e.g., MinIO) for screenshots and assets.
- I support only the essential endpoints:
  - Create a recording session.
  - Request presigned URLs for uploads.
  - Append steps to a session.
  - Mark a session as complete and create a guide.
  - Read and update guides for the editor.
  - Trigger and fetch export jobs.
- I implement basic multi-tenant isolation:
  - Every record is scoped by `tenant_id`.
  - Access is checked at the application layer from day one.

## 3. Web Editor

- I provide a focused web editor for turning captured sessions into usable guides.
- When a guide is opened:
  - It is pre-populated with ordered steps from the recording.
  - Each step has:
    - A title (which I let the user edit),
    - A description field,
    - An attached screenshot.
- The user can:
  - Edit titles and descriptions.
  - Reorder steps via drag-and-drop.
  - Use simple rich text: headings, paragraphs, bullet and numbered lists.
- For screenshots, I include minimal but practical annotation tools:
  - Rectangles/boxes.
  - Blur or pixelate regions.
  - Arrows or labels (at least one directional indicator).
- I autosave changes to the backend and show clear “Saving / Saved” feedback.

## 4. Export & Sharing

- I let the user export a guide as a clean PDF that includes:
  - Step titles,
  - Descriptive text,
  - Annotated screenshots.
- I provide a basic view-only share link so they can share the guide without exposing edit controls.

## 5. Hosted Beta Controls

- I run SnapStep as a controlled hosted beta.
- I enforce a strict global account cap (around 30 users) through configuration.
- I only allow signups or invitations that I explicitly approve (e.g., invite-only or closed signup).

## 6. Non-Functional Guarantees (MVP Level)

- All traffic goes over HTTPS.
- I do not log sensitive content or raw user input.
- I document a simple backup process for:
  - PostgreSQL,
  - Object storage.
- I expose basic health checks and logs so I can:
  - Monitor uptime,
  - Detect failures,
  - Debug issues quickly.

## 7. MVP Boundary

Everything outside this core flow is intentionally **not** part of the MVP. That includes:

- Advanced annotation tools and complex styling.
- Full Notion-style block system (tables, embeds, complex layouts).
- Real-time multi-user collaboration.
- Detailed analytics dashboards.
- Complex role hierarchies and enterprise administration.
- AI-assisted summaries, OCR, and automation.
- Public template galleries and marketplace features.

My MVP success criterion is simple:

If a new user can reliably go from **recording a real workflow** to **sharing a clean, privacy-safe guide** in minutes, with this stack, the MVP is achieved.
