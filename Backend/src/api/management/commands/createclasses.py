from django.core.management.base import BaseCommand
from src.api.models import Class

class Command(BaseCommand):
    help = 'Create Class 1 to Class 10 in the Class model.'

    def handle(self, *args, **options):
        for i in range(1, 11):
            class_name = f'Class {i}'
            obj, created = Class.objects.get_or_create(name=class_name)
            if created:
                self.stdout.write(self.style.SUCCESS(f'Created {class_name}'))
            else:
                self.stdout.write(self.style.WARNING(f'{class_name} already exists')) 