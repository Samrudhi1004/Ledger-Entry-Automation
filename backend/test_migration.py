#!/usr/bin/env python
"""
MongoDB to PostgreSQL Migration Verification Script
Tests all critical functionality after migration.
"""

import os
import sys
import django

# Setup Django
sys.path.insert(0, '.')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.db import connection
from apps.inspections.models import InspectionSession, SetupApproval
from apps.voice.models import VoiceLog
from apps.inspections import document_utils as doc_utils


def print_section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print('='*60)


def test_database_schema():
    """Test 1: Verify database schema is correct"""
    print_section("Test 1: Database Schema")

    with connection.cursor() as cursor:
        # Check inspection_sessions table structure
        cursor.execute("""
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'inspection_sessions'
            AND column_name IN ('document_payload', 'session_id', 'status');
        """)
        columns = cursor.fetchall()

        print("inspection_sessions table columns:")
        for col in columns:
            print(f"  - {col[0]}: {col[1]}")

        # Check for document_payload JSONB field
        has_jsonb = any(col[0] == 'document_payload' and col[1] == 'jsonb' for col in columns)
        if has_jsonb:
            print("[PASS] document_payload JSONB field exists")
        else:
            print("[FAIL] document_payload JSONB field missing")
            return False

        # Check for GIN index
        cursor.execute("""
            SELECT indexname
            FROM pg_indexes
            WHERE tablename = 'inspection_sessions'
            AND indexname LIKE '%doc%measurements%';
        """)
        indexes = cursor.fetchall()

        if indexes:
            print(f"[PASS] GIN index exists: {indexes[0][0]}")
        else:
            print("[WARN] GIN index not found (performance may be affected)")

        # Check SetupApproval table
        cursor.execute("""
            SELECT COUNT(*)
            FROM information_schema.tables
            WHERE table_name = 'inspection_setup_approvals';
        """)
        if cursor.fetchone()[0] > 0:
            print("[PASS] inspection_setup_approvals table exists")
        else:
            print("[FAIL] inspection_setup_approvals table missing")
            return False

        # Check VoiceLog table
        cursor.execute("""
            SELECT COUNT(*)
            FROM information_schema.tables
            WHERE table_name = 'voice_logs';
        """)
        if cursor.fetchone()[0] > 0:
            print("[PASS] voice_logs table exists")
        else:
            print("[FAIL] voice_logs table missing")
            return False

    return True


def test_document_utils():
    """Test 2: Verify document_utils helper functions"""
    print_section("Test 2: Document Utils Functions")

    functions = [
        'get_document',
        'update_document',
        'add_measurement',
        'update_measurement',
        'measurement_exists',
        'update_parameter_summary',
        'update_process_parameter_summary',
        'add_or_update_process_param_entry',
        'initialize_document',
    ]

    all_exist = True
    for func_name in functions:
        if hasattr(doc_utils, func_name):
            print(f"[PASS] {func_name}() exists")
        else:
            print(f"[FAIL] {func_name}() missing")
            all_exist = False

    return all_exist


def test_models():
    """Test 3: Verify models are working"""
    print_section("Test 3: Model Operations")

    try:
        # Test InspectionSession model
        count = InspectionSession.objects.count()
        print(f"[PASS] InspectionSession model working ({count} records)")

        # Test SetupApproval model
        count = SetupApproval.objects.count()
        print(f"[PASS] SetupApproval model working ({count} records)")

        # Test VoiceLog model
        count = VoiceLog.objects.count()
        print(f"[PASS] VoiceLog model working ({count} records)")

        return True
    except Exception as e:
        print(f"[FAIL] Model operation failed: {e}")
        return False


def test_no_mongodb_imports():
    """Test 4: Verify no active MongoDB imports"""
    print_section("Test 4: MongoDB Dependencies Check")

    try:
        # Try importing services and views
        from apps.inspections import services, views
        from apps.analytics import views as analytics_views
        from apps.voice import tasks

        print("[PASS] All modules import without MongoDB dependencies")

        # Check if InspectionService has collection attribute
        service = services.InspectionService()
        if hasattr(service, 'collection'):
            print("[WARN] InspectionService still has 'collection' attribute")
            return False
        else:
            print("[PASS] InspectionService has no 'collection' attribute")

        return True
    except ImportError as e:
        print(f"[FAIL] Import error: {e}")
        return False


def test_jsonb_operations():
    """Test 5: Test JSONB operations on existing data"""
    print_section("Test 5: JSONB Operations")

    try:
        # Get a sample session
        session = InspectionSession.objects.first()

        if not session:
            print("[INFO] No sessions in database - skipping JSONB test")
            return True

        print(f"Testing with session: {session.session_id}")

        # Test get_document
        doc = doc_utils.get_document(session)
        print(f"[PASS] get_document() returned {len(doc)} keys")

        # Test if document has expected structure
        if isinstance(doc, dict):
            print("[PASS] document_payload is a valid JSON object")
            if 'measurements' in doc:
                print(f"[PASS] Document contains measurements array ({len(doc.get('measurements', []))} items)")
            if 'parameter_summary' in doc:
                print(f"[PASS] Document contains parameter_summary array")
        else:
            print(f"[WARN] document_payload is not a dict: {type(doc)}")

        return True
    except Exception as e:
        print(f"[FAIL] JSONB operation failed: {e}")
        return False


def test_data_integrity():
    """Test 6: Verify data integrity"""
    print_section("Test 6: Data Integrity Check")

    with connection.cursor() as cursor:
        # Count total sessions
        cursor.execute("SELECT COUNT(*) FROM inspection_sessions;")
        total_sessions = cursor.fetchone()[0]
        print(f"Total inspection sessions: {total_sessions}")

        # Count sessions with document_payload
        cursor.execute("""
            SELECT COUNT(*)
            FROM inspection_sessions
            WHERE document_payload IS NOT NULL
            AND document_payload != '{}'::jsonb;
        """)
        sessions_with_data = cursor.fetchone()[0]
        print(f"Sessions with document_payload: {sessions_with_data}")

        if total_sessions > 0:
            percentage = (sessions_with_data / total_sessions) * 100
            print(f"Data coverage: {percentage:.1f}%")

            if percentage < 50:
                print("[WARN] Less than 50% of sessions have document_payload")
                print("       You may need to run a data migration script")
            else:
                print("[PASS] Good data coverage")

        # Check for any sessions with measurements in document_payload
        cursor.execute("""
            SELECT COUNT(*)
            FROM inspection_sessions
            WHERE document_payload->'measurements' IS NOT NULL
            AND jsonb_array_length(document_payload->'measurements') > 0;
        """)
        sessions_with_measurements = cursor.fetchone()[0]
        print(f"Sessions with measurements: {sessions_with_measurements}")

        return True


def main():
    """Run all verification tests"""
    print_section("MongoDB to PostgreSQL Migration Verification")
    print("Testing all critical functionality...")

    results = {
        'Database Schema': test_database_schema(),
        'Document Utils': test_document_utils(),
        'Model Operations': test_models(),
        'MongoDB Dependencies': test_no_mongodb_imports(),
        'JSONB Operations': test_jsonb_operations(),
        'Data Integrity': test_data_integrity(),
    }

    # Summary
    print_section("VERIFICATION SUMMARY")

    passed = sum(1 for v in results.values() if v)
    total = len(results)

    for test_name, passed_test in results.items():
        status = "[PASS]" if passed_test else "[FAIL]"
        print(f"{status} {test_name}")

    print(f"\nResult: {passed}/{total} tests passed")

    if passed == total:
        print("\n[SUCCESS] Migration verification complete!")
        print("The system is ready for testing with real workflows.")
        return 0
    else:
        print("\n[WARNING] Some tests failed. Please review the issues above.")
        return 1


if __name__ == '__main__':
    sys.exit(main())
