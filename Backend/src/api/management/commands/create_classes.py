from django.core.management.base import BaseCommand
from src.api.models import Class

class Command(BaseCommand):
    help = 'Create Class 1 through Class 10'

    def handle(self, *args, **options):
        classes_created = 0
        for i in range(1, 11):
            class_name = f'Class {i}'
            class_obj, created = Class.objects.get_or_create(name=class_name)
            if created:
                classes_created += 1
                self.stdout.write(
                    self.style.SUCCESS(f'Successfully created {class_name}')
                )
            else:
                self.stdout.write(
                    self.style.WARNING(f'{class_name} already exists')
                )
        
        self.stdout.write(
            self.style.SUCCESS(f'Total classes created: {classes_created}')
        ) 