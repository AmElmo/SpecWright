#!/bin/bash

# Path Refactoring Audit Script
# This script searches for any remaining hardcoded path references that should be using the centralized path utilities

echo "=================================================="
echo "🔍 PATH REFACTORING AUDIT"
echo "=================================================="
echo ""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

issues_found=0

# Function to check for pattern and report
check_pattern() {
    local pattern=$1
    local description=$2
    local exclude_pattern=$3
    
    echo "Checking: $description"
    
    if [ -n "$exclude_pattern" ]; then
        results=$(grep -r -n "$pattern" src/ --include="*.ts" --include="*.tsx" --exclude-dir=node_modules | grep -v "$exclude_pattern" | grep -v "project-paths.ts" | grep -v "// " | grep -v "//" || true)
    else
        results=$(grep -r -n "$pattern" src/ --include="*.ts" --include="*.tsx" --exclude-dir=node_modules | grep -v "project-paths.ts" | grep -v "// " || true)
    fi
    
    if [ -n "$results" ]; then
        echo -e "${RED}  ❌ Found potential issues:${NC}"
        echo "$results" | head -10
        if [ $(echo "$results" | wc -l) -gt 10 ]; then
            echo -e "${YELLOW}  ... and $(( $(echo "$results" | wc -l) - 10 )) more${NC}"
        fi
        issues_found=$((issues_found + 1))
        echo ""
    else
        echo -e "${GREEN}  ✓ No issues found${NC}"
        echo ""
    fi
}

echo "1️⃣  HARDCODED FOLDER PATHS"
echo "================================"
check_pattern "path\.join.*['\"]pm['\"]" "Old pm/ folder references"
check_pattern "path\.join.*['\"]ux['\"]" "Old ux/ folder references" "ux_designer|ux_questions"
check_pattern "path\.join.*['\"]engineer['\"]" "Old engineer/ folder references" "engineer_questions|engineer_output"
check_pattern "path\.join.*['\"]architect['\"]" "Old architect/ folder references"
echo ""

echo "2️⃣  HARDCODED FILE PATHS IN STRINGS"
echo "================================"
check_pattern "'pm/pm_questions" "PM questions path in strings"
check_pattern "\"pm/pm_questions" "PM questions path in strings"
check_pattern "'ux/ux_questions" "UX questions path in strings"
check_pattern "\"ux/ux_questions" "UX questions path in strings"
check_pattern "'questions/engineer_questions" "Engineer questions path in strings"
check_pattern "\"questions/engineer_questions" "Engineer questions path in strings"
check_pattern "'documents/technology_choices" "Technology choices path in strings"
check_pattern "\"documents/technology_choices" "Technology choices path in strings"
echo ""

echo "3️⃣  DOCUMENT FILE REFERENCES (should be in documents/)"
echo "================================"
check_pattern "projectPath.*product_requirements_document" "PRD path construction"
check_pattern "projectPath.*design_brief" "Design brief path construction"
check_pattern "projectPath.*technical_specification" "Technical spec path construction"
check_pattern "projectPath.*ux_designer_wireframes" "Wireframes path construction"
echo ""

echo "4️⃣  CHECKING FOR PROPER IMPORTS"
echo "================================"

# Check files that should import from project-paths
files_to_check=(
    "src/services/project-service.ts"
    "src/services/agent-service.ts"
    "src/services/phase-validation-service.ts"
    "src/services/workflow-service.ts"
    "src/services/prompt-generator.ts"
    "src/web-server.ts"
)

for file in "${files_to_check[@]}"; do
    if [ -f "$file" ]; then
        if grep -q "from.*project-paths" "$file"; then
            echo -e "${GREEN}  ✓ $file imports project-paths${NC}"
        else
            echo -e "${RED}  ❌ $file does NOT import project-paths${NC}"
            issues_found=$((issues_found + 1))
        fi
    fi
done
echo ""

echo "5️⃣  VERIFYING PATH UTILITY USAGE"
echo "================================"

# Check if key functions are being used
check_usage() {
    local func_name=$1
    local count=$(grep -r "$func_name" src/ --include="*.ts" --include="*.tsx" --exclude-dir=node_modules | wc -l)
    
    if [ $count -gt 0 ]; then
        echo -e "${GREEN}  ✓ $func_name is used ($count times)${NC}"
    else
        echo -e "${YELLOW}  ⚠ $func_name is never used (might be okay)${NC}"
    fi
}

check_usage "getPMQuestionsPath"
check_usage "getUXQuestionsPath"
check_usage "getEngineerQuestionsPath"
check_usage "getPRDPath"
check_usage "getDesignBriefPath"
check_usage "getTechnicalSpecPath"
check_usage "getTechnologyChoicesPath"
echo ""

echo "=================================================="
if [ $issues_found -eq 0 ]; then
    echo -e "${GREEN}✅ AUDIT PASSED - No critical issues found!${NC}"
else
    echo -e "${RED}⚠️  AUDIT FOUND $issues_found POTENTIAL ISSUES${NC}"
    echo "Please review the findings above and fix as needed."
fi
echo "=================================================="

