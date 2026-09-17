# DEPRECATED: This script has been replaced by a safe Django management command.
#
# Do NOT run this file directly. It previously deleted a hard-coded conversation
# ID without any confirmation or dry-run protection.
#
# Use the proper management command instead:
#
#   # Dry-run (safe, no changes made):
#   python manage.py delete_duplicate_conversation --dry-run
#
#   # Actually delete (requires explicit confirmation flag):
#   python manage.py delete_duplicate_conversation --confirm
#
# See: apps/messaging/management/commands/delete_duplicate_conversation.py

raise SystemExit(
    "This script is deprecated. Use the management command instead:\n"
    "  python manage.py delete_duplicate_conversation --help"
)
