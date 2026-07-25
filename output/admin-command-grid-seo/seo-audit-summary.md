# SEO/GEO Audit Report

Generated: 2026-07-24T05:15:41.202Z
Site: http://127.0.0.1:3000
Pages crawled: 0

This audit is deterministic and report-only. It does not call Codex, LLM APIs, search engines, or AI answer engines.

## Top Recommended Fix

- **HIGH / query-map**: Priority query target is absent from the sitemap.
  - URL: /resume-examples/software-engineer
  - Query: software engineer resume example
  - Impact: The target page may be harder for crawlers to discover and prioritize.
  - Recommendation: Add the mapped target URL to the generated sitemap.

## Scorecard

| Severity | Count |
| --- | ---: |
| critical | 0 |
| high | 4 |
| medium | 1 |
| low | 0 |

## Priority Query Map

| Query | Target | Status |
| --- | --- | --- |
| free AI resume builder | /tools/resume-builder | missing |
| free ATS analyzer | /tools/ats-analyzer | missing |
| AI interview practice | /tools/interview-prep | missing |
| software engineer resume example | /resume-examples/software-engineer | missing |

## Ranked Gaps

- **HIGH / query-map** Priority query target is absent from the sitemap.
  - URL: /resume-examples/software-engineer
  - Query: software engineer resume example
  - Recommendation: Add the mapped target URL to the generated sitemap.
- **HIGH / query-map** Priority query target is absent from the sitemap.
  - URL: /tools/ats-analyzer
  - Query: free ATS analyzer
  - Recommendation: Add the mapped target URL to the generated sitemap.
- **HIGH / query-map** Priority query target is absent from the sitemap.
  - URL: /tools/interview-prep
  - Query: AI interview practice
  - Recommendation: Add the mapped target URL to the generated sitemap.
- **HIGH / query-map** Priority query target is absent from the sitemap.
  - URL: /tools/resume-builder
  - Query: free AI resume builder
  - Recommendation: Add the mapped target URL to the generated sitemap.
- **MEDIUM / crawlability** robots.txt does not list the default sitemap URL.
  - URL: http://127.0.0.1:3000/robots.txt
  - Recommendation: Add "Sitemap: http://127.0.0.1:3000/sitemap.xml" to robots.txt.

## Page Metrics

| URL | Status | Words | Internal Links | JSON-LD | Title |
| --- | ---: | ---: | ---: | ---: | --- |
