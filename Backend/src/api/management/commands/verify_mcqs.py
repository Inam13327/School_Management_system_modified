from django.core.management.base import BaseCommand
from api.models import MCQ

class Command(BaseCommand):
    help = 'Verifies MCQs in the database'

    def handle(self, *args, **kwargs):
        # Check total count
        total_count = MCQ.objects.count()
        self.stdout.write(f'Total MCQs in database: {total_count}')

        # Check count by subject
        for subject in ['physics', 'chemistry', 'mathematics']:
            count = MCQ.objects.filter(subject=subject).count()
            self.stdout.write(f'{subject.capitalize()} MCQs: {count}')

        # Show sample questions
        self.stdout.write('\nSample Questions:')
        for subject in ['physics', 'chemistry', 'mathematics']:
            self.stdout.write(f'\n{subject.capitalize()} Questions:')
            questions = MCQ.objects.filter(subject=subject)[:2]
            for q in questions:
                self.stdout.write(f'\nQuestion: {q.question}')
                self.stdout.write(f'Options: {q.options}')
                self.stdout.write(f'Correct Answer: {q.correct_answer}') 