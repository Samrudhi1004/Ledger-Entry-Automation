#!/bin/bash

# MongoDB to PostgreSQL Migration - Data Backup Script
# Run this script BEFORE making any code changes
# Creates JSON backups of all MongoDB collections

echo "=================================================="
echo "MongoDB Backup Script - Ledger Entry Automation"
echo "=================================================="
echo ""

# Configuration (update these if your MongoDB setup is different)
MONGODB_URI="${MONGODB_URI:-mongodb://localhost:27017}"
DB_NAME="${MONGODB_NAME:-voice_inspection_db}"
BACKUP_DIR="./mongodb_backups_$(date +%Y%m%d_%H%M%S)"

echo "MongoDB URI: $MONGODB_URI"
echo "Database: $DB_NAME"
echo "Backup directory: $BACKUP_DIR"
echo ""

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo "Starting backup process..."
echo ""

# Backup inspection_records collection
echo "[1/3] Exporting inspection_records collection..."
mongoexport --uri="$MONGODB_URI" \
  --db="$DB_NAME" \
  --collection=inspection_records \
  --out="$BACKUP_DIR/inspection_records.json" \
  --jsonArray

if [ $? -eq 0 ]; then
    echo "✓ inspection_records exported successfully"
    RECORDS_COUNT=$(grep -c '"_id"' "$BACKUP_DIR/inspection_records.json" || echo "0")
    echo "  Records: $RECORDS_COUNT"
else
    echo "✗ Failed to export inspection_records"
fi
echo ""

# Backup voice_logs collection
echo "[2/3] Exporting voice_logs collection..."
mongoexport --uri="$MONGODB_URI" \
  --db="$DB_NAME" \
  --collection=voice_logs \
  --out="$BACKUP_DIR/voice_logs.json" \
  --jsonArray

if [ $? -eq 0 ]; then
    echo "✓ voice_logs exported successfully"
    LOGS_COUNT=$(grep -c '"_id"' "$BACKUP_DIR/voice_logs.json" || echo "0")
    echo "  Records: $LOGS_COUNT"
else
    echo "✗ Failed to export voice_logs"
fi
echo ""

# Backup audit_logs collection (if exists)
echo "[3/3] Exporting audit_logs collection..."
mongoexport --uri="$MONGODB_URI" \
  --db="$DB_NAME" \
  --collection=audit_logs \
  --out="$BACKUP_DIR/audit_logs.json" \
  --jsonArray 2>/dev/null

if [ $? -eq 0 ]; then
    echo "✓ audit_logs exported successfully"
    AUDIT_COUNT=$(grep -c '"_id"' "$BACKUP_DIR/audit_logs.json" || echo "0")
    echo "  Records: $AUDIT_COUNT"
else
    echo "⚠ audit_logs collection not found (this is OK if not used)"
fi
echo ""

# Create backup summary
echo "=================================================="
echo "Backup Summary"
echo "=================================================="
echo "Backup location: $BACKUP_DIR"
echo ""
echo "Files created:"
ls -lh "$BACKUP_DIR"
echo ""
echo "Total backup size:"
du -sh "$BACKUP_DIR"
echo ""
echo "✓ Backup completed successfully!"
echo ""
echo "IMPORTANT: Keep these backup files safe."
echo "They will be used for the migration to PostgreSQL."
echo "=================================================="
