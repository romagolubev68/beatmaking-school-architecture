# Lab 3 Route Matrix

| Route | Access | Data Source | Notes |
| --- | --- | --- | --- |
| `/` | Public | `GET /api/home/summary` | Home stats and popular beats |
| `/auth/login` | Public | Local form + auth API | Redirects to profile if already logged in |
| `/auth/register` | Public | Local form + auth API | Client-side validation before submit |
| `/courses` | Public | `GET /api/beats` | Search, filters, sorting, pagination |
| `/courses/:id` | Public | `GET /api/beats/item/:id` | Like/favorite actions |
| `/mentors` | Public | `GET /api/mentors` | Dynamic mentors list |
| `/profile` | Private | `GET /api/auth/me`, `GET /api/beats/my` | Create beat content |
| `/dashboard` | Private | `GET /api/beats/dashboard/summary` | Training metrics |
| `/checkout` | Private | `GET /api/beats/by-ids/list` | Dynamic cart summary |
