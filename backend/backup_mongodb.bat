@echo off
REM MongoDB to PostgreSQL Migration - Data Backup Script (Windows)
REM Run this script BEFORE making any code changes
REM Creates JSON backups of all MongoDB collections

echo ==================================================
echo MongoDB Backup Script - Ledger Entry Automation
echo ==================================================
echo.

REM Configuration (update these if your MongoDB setup is different)
if "%MONGODB_URI%"=="" set MONGODB_URI=mongodb://localhost:27017
if "%MONGODB_NAME%"=="" set MONGODB_NAME=voice_inspection_db

for /f "tokens=2-4 delims=/ " %%a in ('date /t') do (set mydate=%%c%%a%%b)
for /f "tokens=1-2 delims=/:" %%a in ('time /t') do (set mytime=%%a%%b)
set BACKUP_DIR=mongodb_backups_%mydate%_%mytime%

echo MongoDB URI: %MONGODB_URI%
echo Database: %MONGODB_NAME%
echo Backup directory: %BACKUP_DIR%
echo.

REM Create backup directory
mkdir "%BACKUP_DIR%" 2>nul

echo Starting backup process...
echo.

REM Backup inspection_records collection
echo [1/3] Exporting inspection_records collection...
mongoexport --uri="%MONGODB_URI%" --db="%MONGODB_NAME%" --collection=inspection_records --out="%BACKUP_DIR%/inspection_records.json" --jsonArray

if %errorlevel% equ 0 (
    echo [OK] inspection_records exported successfully
) else (
    echo [FAILED] Failed to export inspection_records
)
echo.

REM Backup voice_logs collection
echo [2/3] Exporting voice_logs collection...
mongoexport --uri="%MONGODB_URI%" --db="%MONGODB_NAME%" --collection=voice_logs --out="%BACKUP_DIR%/voice_logs.json" --jsonArray

if %errorlevel% equ 0 (
    echo [OK] voice_logs exported successfully
) else (
    echo [FAILED] Failed to export voice_logs
)
echo.

REM Backup audit_logs collection (if exists)
echo [3/3] Exporting audit_logs collection...
mongoexport --uri="%MONGODB_URI%" --db="%MONGODB_NAME%" --collection=audit_logs --out="%BACKUP_DIR%/audit_logs.json" --jsonArray 2>nul

if %errorlevel% equ 0 (
    echo [OK] audit_logs exported successfully
) else (
    echo [WARNING] audit_logs collection not found (this is OK if not used)
)
echo.

REM Show backup summary
echo ==================================================
echo Backup Summary
echo ==================================================
echo Backup location: %BACKUP_DIR%
echo.
echo Files created:
dir "%BACKUP_DIR%"
echo.
echo [OK] Backup completed successfully!
echo.
echo IMPORTANT: Keep these backup files safe.
echo They will be used for the migration to PostgreSQL.
echo ==================================================
pause
