#!/usr/bin/env bash
set -euo pipefail

exec node apps/backend/dist/lambda.cjs
