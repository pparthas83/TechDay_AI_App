#!/usr/bin/env bash
# Quick launcher for Con Edison Tech Day Holographic AI Moderator
PORT="${1:-8080}"
echo "=========================================================="
echo "  TECH DAY // HOLOGRAPHIC AI MODERATOR"
echo "  Serving app on: http://localhost:${PORT}"
echo "  Direct Stage Mode: http://localhost:${PORT}/?stage=true"
echo "=========================================================="
cd "$(dirname "$0")"
python3 -m http.server "$PORT"
