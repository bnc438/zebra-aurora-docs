#!/bin/bash

# GitHub Branch Protection Setup Script
# Enforces required status checks on main branch
# Usage: ./setup-branch-protection.sh <owner> <repo> <github-token>
# Example: ./setup-branch-protection.sh zebra-technologies zebra-aurora-docs ghp_xxxxxxxxxxxxx

set -euo pipefail

OWNER="${1:-}"
REPO="${2:-}"
TOKEN="${3:-}"

if [ -z "$OWNER" ] || [ -z "$REPO" ] || [ -z "$TOKEN" ]; then
    echo "Usage: $0 <owner> <repo> <github-token>"
    echo ""
    echo "Arguments:"
    echo "  owner         GitHub organization/username"
    echo "  repo          Repository name"
    echo "  github-token  Personal access token with 'repo' and 'admin:repo_hook' scopes"
    echo ""
    echo "Example:"
    echo "  $0 zebra-technologies zebra-aurora-docs ghp_xxxxxxxxxxxxx"
    exit 1
fi

BRANCH="main"
API_URL="https://api.github.com/repos/${OWNER}/${REPO}"

echo "Setting up branch protection for ${OWNER}/${REPO}:${BRANCH}"
echo ""

# Required status checks that must pass before merge
REQUIRED_CHECKS=(
    "ENG-01 Production Build"
    "ENG-08 E2E Tests Across Browsers"
    "ENG-09 Internal Links Validation"
    "ENG-10 Lighthouse CI"
    "ENG-14 Security Audit"
)

# Convert array to JSON format
CHECKS_JSON="["
for check in "${REQUIRED_CHECKS[@]}"; do
    CHECKS_JSON="${CHECKS_JSON}{\"context\":\"${check}\"},"
done
CHECKS_JSON="${CHECKS_JSON%,}]"  # Remove trailing comma

# Build protection rule payload
PROTECTION_PAYLOAD=$(cat <<EOF
{
  "required_status_checks": {
    "strict": true,
    "contexts": $(echo "$REQUIRED_CHECKS" | jq -R 'split("\n") | map(select(length > 0))')
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 1
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "allow_auto_merge": true,
  "require_linear_history": false,
  "require_conversation_resolution": true,
  "require_status_checks": true
}
EOF
)

echo "Applying branch protection rule with required checks:"
for check in "${REQUIRED_CHECKS[@]}"; do
    echo "  ✓ $check"
done
echo ""

# Apply branch protection
RESPONSE=$(curl -s -X PUT \
  -H "Authorization: token ${TOKEN}" \
  -H "Accept: application/vnd.github.v3+json" \
  -d @<(cat <<EOF
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "ENG-01 Production Build",
      "ENG-08 E2E Tests Across Browsers",
      "ENG-09 Internal Links Validation",
      "ENG-10 Lighthouse CI",
      "ENG-14 Security Audit"
    ]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 1
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "allow_auto_merge": true,
  "require_linear_history": false,
  "require_conversation_resolution": true
}
EOF
) \
  "${API_URL}/branches/${BRANCH}/protection"
)

# Check response
if echo "$RESPONSE" | jq -e '.url' > /dev/null 2>&1; then
    echo "✓ Branch protection successfully applied to '${BRANCH}'"
    echo ""
    echo "Enforced rules:"
    echo "  • All 5 required status checks must pass"
    echo "  • Strict mode: PR branch must be up-to-date with base"
    echo "  • Dismiss stale reviews after new push"
    echo "  • Require 1 approval before merge"
    echo "  • Resolve conversations before merge"
    echo "  • Allow auto-merge for admins"
    echo ""
    echo "Next steps:"
    echo "  1. Push workflow files to .github/workflows/"
    echo "  2. Create a test PR to trigger checks"
    echo "  3. Verify all checks pass in PR status"
    echo "  4. Checks are now merge blockers"
else
    echo "✗ Error applying branch protection:"
    echo "$RESPONSE" | jq '.' || echo "$RESPONSE"
    exit 1
fi
