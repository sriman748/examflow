# ExamFlow API (MVP core)
```
cp .env.example .env      # set JWT_SECRET
docker compose up -d      # Postgres + schema
npm install && npm run seed && npm start
```
Smoke test: login (`POST /api/auth/login`) as admin → create faculty/student (`POST /api/users`) → course (`POST /api/courses`) → enroll → faculty adds questions (or `POST /api/questions/parse` on pasted text, review, then save) → `POST /api/tests` → publish → student `POST /api/tests/:id/start` → `PUT /api/attempts/:id/answers` (autosave) → `POST /api/attempts/:id/submit` → faculty `POST /api/tests/:id/release` → student `GET /api/attempts/:id/result`; faculty `GET /api/tests/:id/results?format=csv`.

Security built in: bcrypt(12), 2h JWT, login rate-limit + lockout, backend RBAC and ownership checks, answer key never sent to students, server-side deadline and grading, unique attempt per student/test, audit log, CSV formula-injection guard.

## Web UI
Open http://localhost:3000 after `npm start` and log in with the seeded admin. Admin creates faculty/students/courses and enrolls students; faculty pastes question text, reviews drafts, saves, builds and publishes a test; students take it (timer, palette, autosave with retry, auto-submit) and view results once released.
