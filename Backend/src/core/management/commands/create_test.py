from django.core.management.base import BaseCommand
from core.models import Test

class Command(BaseCommand):
    help = 'Create MCQ test instance'

    def handle(self, *args, **options):
        test, created = Test.objects.get_or_create(
            name='Subject MCQ Test',
            defaults={
                'total_questions': 30,
                'duration_minutes': 20
            }
        )

        if created:
            self.stdout.write(self.style.SUCCESS('Successfully created MCQ test'))
        else:
            self.stdout.write(self.style.SUCCESS('MCQ test already exists'))
