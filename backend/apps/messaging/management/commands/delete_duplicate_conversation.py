"""
Management command: delete_duplicate_conversation

Safe replacement for the deprecated backend/delete_duplicate.py script.

Usage:
    # Preview - no changes made:
    python manage.py delete_duplicate_conversation --dry-run

    # Actually delete (requires explicit confirmation):
    python manage.py delete_duplicate_conversation --confirm

    # Override the target conversation ID:
    python manage.py delete_duplicate_conversation --confirm --conversation-id <uuid>
"""
from django.core.management.base import BaseCommand, CommandError
from apps.messaging.models import Conversation


# Default target ID (the known duplicate); can be overridden via --conversation-id.
DEFAULT_CONVERSATION_ID = '257537cd-5601-47f1-9a5e-601aad0db25c'


class Command(BaseCommand):
    help = (
        'Safely delete a duplicate conversation by UUID. '
        'Requires --confirm to actually delete; use --dry-run to preview.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--conversation-id',
            default=DEFAULT_CONVERSATION_ID,
            help=(
                f'UUID of the conversation to delete '
                f'(default: {DEFAULT_CONVERSATION_ID})'
            ),
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            default=False,
            help='Preview what would be deleted without making any changes.',
        )
        parser.add_argument(
            '--confirm',
            action='store_true',
            default=False,
            help='Required flag to actually perform the deletion.',
        )

    def handle(self, *args, **options):
        conversation_id = options['conversation_id']
        dry_run = options['dry_run']
        confirm = options['confirm']

        if not dry_run and not confirm:
            raise CommandError(
                'You must supply either --dry-run (to preview) or '
                '--confirm (to actually delete). '
                'Run with --help for usage.'
            )

        try:
            conversation = Conversation.objects.get(id=conversation_id)
        except Conversation.DoesNotExist:
            self.stdout.write(
                self.style.WARNING(
                    f'No conversation found with id={conversation_id}. Nothing to do.'
                )
            )
            return

        self.stdout.write(
            f'Found conversation: id={conversation.id}'
        )

        if dry_run:
            self.stdout.write(
                self.style.NOTICE(
                    '[DRY RUN] Would delete the conversation above. '
                    'Re-run with --confirm to apply.'
                )
            )
            return

        conversation.delete()
        self.stdout.write(
            self.style.SUCCESS(
                f'Successfully deleted conversation {conversation_id}.'
            )
        )
