#!/usr/bin/env bash

set -e

BOLD="\033[1m"
GREEN="\033[32m"
CYAN="\033[36m"
RED="\033[31m"
RESET="\033[0m"

echo -e "${BOLD}${CYAN}=====================================================================${RESET}"
echo -e "${BOLD}${CYAN}      SOVEREIGN NEXUS AUTOMATED REGRESSION & INVARIANT GUARD        ${RESET}"
echo -e "${BOLD}${CYAN}=====================================================================${RESET}"

# Step 1: Run TypeScript type check / linting
echo -e "\n${BOLD}[STEP 1/2] Running TypeScript Type Check & Linter...${RESET}"
npm run lint

# Step 2: Run Architectural Invariants Check
echo -e "\n${BOLD}[STEP 2/2] Running Architectural Invariant Verification...${RESET}"
node scripts/verify_invariants.js

echo -e "\n${BOLD}${GREEN}✔ All regression guard checks passed successfully.${RESET}\n"
