# Lab 3 API Examples

## Public
- `GET /api/home/summary`
- `GET /api/mentors`
- `GET /api/beats?search=trap&genre=Trap&minPrice=10&maxPrice=50&sort=likes_desc&page=1&limit=6`
- `GET /api/beats/item/1`

## Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me` (Bearer token)

## Private Beats Actions
- `POST /api/beats` (Bearer token)
- `GET /api/beats/my` (Bearer token)
- `POST /api/beats/item/1/like` (Bearer token)
- `POST /api/beats/item/1/favorite` (Bearer token)
- `GET /api/beats/dashboard/summary` (Bearer token)
- `GET /api/beats/by-ids/list?ids=1,2,3` (used by checkout page)
