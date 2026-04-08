# GitHub API Integration Setup

This document explains how to enable live GitHub Actions run-status tracking in the Engineering Tests dashboard.

## Overview

The dashboard can fetch and display live workflow run outcomes (pass/fail/in-progress/duration) from GitHub Actions via the GitHub REST API. This requires:

1. **GITHUB_TOKEN** - Automatically available in GitHub Actions environments
2. **GITHUB_REPO** - Repository identifier in `owner/repo` format  
3. **GITHUB_API_TIMEOUT_MS** (optional) - API request timeout in milliseconds (default: 5000)

## Configuration Steps

### Step 1: Set Repository Secret

The build report generator needs access to the repository slug (`owner/repo`). Store it as a repository secret:

1. Go to your repository settings: `https://github.com/<owner>/<repo>/settings/secrets`
2. Click **New repository secret**
3. Name: `GITHUB_REPO`
4. Value: `<owner>/<repo>` (e.g., `zebra-technologies/zebra-aurora-docs`)
5. Click **Add secret**

### Step 2: Update GitHub Actions Workflows

Add the secret to any workflow that needs to generate the build report with GitHub API integration:

```yaml
- name: Generate build report with GitHub API integration
  run: node scripts/generate-build-report.mjs
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}      # Built-in, always available
    GITHUB_REPO: ${{ secrets.GITHUB_REPO }}         # User-configured secret
    GITHUB_API_TIMEOUT_MS: '8000'                   # Optional: adjust timeout
```

### Step 3: Enable in Dev Environment (Local)

To test the GitHub API integration locally:

```bash
# Set your GitHub personal access token (requires repo:read scope)
export GITHUB_TOKEN=ghp_xxxxxxxxxxxxx

# Set the repository identifier
export GITHUB_REPO=owner/repo

# Generate report with API integration
npm run build:report
```

**To create a personal access token**:
1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click **Generate new token**
3. Name: `Build Report Generation`
4. Select scopes: `public_repo` (or `repo` for private)
5. Copy the token and store securely

## Verification

After setup, run the build report generator and verify:

```bash
# Generate report
node scripts/generate-build-report.mjs

# Check if API integration worked
node -e "console.log(require('./static/build-report.json').aggregate.engineeringTests.githubActions)"
```

Look for these fields:
- `gateStatus[n].latestRun.status` - Should show 'passed', 'failed', 'in_progress', or 'unknown'
- `gateStatus[n].latestRun.durationSec` - Duration of latest workflow run
- `gateStatus[n].latestRun.runUrl` - Link to GitHub Actions run page

If these are missing or show `null`, the API integration is not connected. Check:
1. GITHUB_TOKEN is set and valid
2. GITHUB_REPO is set to `owner/repo` format
3. Workflows exist in `.github/workflows/` directory
4. Workflows have PR triggers (required for branch protection enforcement)

## Graceful Degradation

The dashboard works without GitHub API credentials:
- Run status shows "Not run yet" or "Unavailable"
- Dashboard remains fully functional with workflow configuration checks only
- No errors or failures occur due to missing API credentials

To debug API connection issues, check the build report generation output:
```bash
node scripts/generate-build-report.mjs 2>&1 | grep -i "github\|api\|error"
```

## CI/CD Integration

The recommended workflow for CI/CD:

1. **Pull Request**: 
   - ENG-01 build validates code compiles
   - ENG-08 e2e ensures critical paths work
   - ENG-09 links confirms no broken internal URLs
   - ENG-10 lighthouse verifies performance/accessibility
   - ENG-14 security audits for CVEs
   - Build report generated with live run status updates

2. **Build Report**: 
   - Uploaded as artifact
   - Published to static site
   - Dashboard reads from `static/build-report.json`

3. **Dashboard Display**:
   - Shows gate configuration readiness (file exists, triggers configured)
   - Shows live latest run outcome (if API connected)
   - Shows pass/fail counts and run duration

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Run outcomes show "Unavailable" | Verify GITHUB_REPO is set as `owner/repo`, not just URL |
| API timeout errors in logs | Increase `GITHUB_API_TIMEOUT_MS` (e.g., to 10000) |
| Workflows not detected | Confirm files exist in `.github/workflows/` with `.yml` extension |
| Rate limit exceeded | Add slight delay between API calls or use GitHub App token |
| Token permission denied | Ensure token has `repo` or `public_repo` scope |

## References

- [GitHub REST API Documentation](https://docs.github.com/en/rest)
- [GitHub Actions Environment Variables](https://docs.github.com/en/actions/learn-github-actions/environment-variables)
- [Repository Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
