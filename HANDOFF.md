# Handoff

## Current State

- Uploads are real: `POST /api/uploads`
- Recognition is async: `POST /api/recognitions`, poll with `GET /api/recognitions/:jobId`
- Recognition provider is Zhipu in [server/lib/recognition.js](/C:/Users/admin/source/repos/invasive-species-reporter/server/lib/recognition.js:1)
- Recognition jobs and retry logic are in [server/lib/recognition-jobs.js](/C:/Users/admin/source/repos/invasive-species-reporter/server/lib/recognition-jobs.js:1)
- Reports are still in-memory mock data in [server/data/mock-data.js](/C:/Users/admin/source/repos/invasive-species-reporter/server/data/mock-data.js:1)

## Frontend Flow

- Upload/report page: [miniprogram/pages/report/report.js](/C:/Users/admin/source/repos/invasive-species-reporter/miniprogram/pages/report/report.js:1)
- Review page: [miniprogram/pages/review/review.js](/C:/Users/admin/source/repos/invasive-species-reporter/miniprogram/pages/review/review.js:1)
- Map page: [miniprogram/pages/map/map.js](/C:/Users/admin/source/repos/invasive-species-reporter/miniprogram/pages/map/map.js:1)

## If Switching To Kimi / Claude Code

- Keep upload flow unchanged.
- Replace only provider-specific code in `server/lib/recognition.js`.
- Preserve returned shape:
  - `matchedSpeciesId`
  - `matchedSpeciesName`
  - `confidence`
  - `summary`
  - `topCandidates`
- Do not remove async job flow; front-end already depends on it.

## Recommended Next Steps

1. Move reports/jobs/species to MySQL or cloud DB.
2. Add provider fallback chain: Zhipu -> secondary model.
3. Add auth and reviewer roles.
4. Replace remote sample species images with curated local assets if needed.
