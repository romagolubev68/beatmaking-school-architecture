# Lab 3 Test Plan

## Access Control
- Open `/profile` while logged out -> redirect to `/auth/login`.
- Open `/dashboard` while logged out -> redirect to `/auth/login`.
- Open `/checkout` while logged out -> redirect to `/auth/login`.

## Auth UI State
- Logged out: `Войти` and `Регистрация` are visible.
- Logged in: `Выйти` and user name are visible.

## Catalog Logic
- Search by keyword changes results.
- Filters by genre and price range change results.
- Sort options change order.
- Pagination buttons switch result pages.

## Interactive Actions
- Like toggle updates like counter.
- Favorite toggle persists in backend.

## UX
- Loading indicators appear on data-heavy pages.
- API failures render visible error blocks.
- Layout is usable at 375px width.
