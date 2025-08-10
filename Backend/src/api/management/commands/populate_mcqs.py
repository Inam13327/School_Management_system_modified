from django.core.management.base import BaseCommand
from src.api.models import MCQ

class Command(BaseCommand):
    help = 'Populates the database with sample MCQs'

    def handle(self, *args, **kwargs):
        # Clear existing MCQs
        MCQ.objects.all().delete()
        self.stdout.write('Cleared existing MCQs')

        # Sample Physics questions
        physics_questions = [
            {
                'question': 'What is the SI unit of force?',
                'options': ['Newton', 'Joule', 'Watt', 'Pascal'],
                'correct_answer': 'Newton',
                'explanation': 'The SI unit of force is Newton (N), defined as the force needed to accelerate 1 kg at 1 m/s².'
            },
            {
                'question': 'Which of the following is a vector quantity?',
                'options': ['Speed', 'Distance', 'Velocity', 'Time'],
                'correct_answer': 'Velocity',
                'explanation': 'Velocity is a vector quantity as it has both magnitude and direction.'
            },
            # Add more physics questions here...
        ]

        # Sample Chemistry questions
        chemistry_questions = [
            {
                'question': 'What is the atomic number of Carbon?',
                'options': ['6', '12', '14', '16'],
                'correct_answer': '6',
                'explanation': 'Carbon has 6 protons, therefore its atomic number is 6.'
            },
            {
                'question': 'Which of the following is a noble gas?',
                'options': ['Chlorine', 'Helium', 'Nitrogen', 'Oxygen'],
                'correct_answer': 'Helium',
                'explanation': 'Helium is a noble gas, characterized by its stable electron configuration.'
            },
            # Add more chemistry questions here...
        ]

        # Sample Mathematics questions
        mathematics_questions = [
            {
                'question': 'What is the derivative of sin(x)?',
                'options': ['cos(x)', '-sin(x)', 'tan(x)', 'cot(x)'],
                'correct_answer': 'cos(x)',
                'explanation': 'The derivative of sin(x) is cos(x).'
            },
            {
                'question': 'What is the value of π (pi) to two decimal places?',
                'options': ['3.14', '3.16', '3.12', '3.18'],
                'correct_answer': '3.14',
                'explanation': 'π is approximately 3.14159, which rounds to 3.14 to two decimal places.'
            },
            # Add more mathematics questions here...
        ]

        # Add questions to database
        for question in physics_questions:
            MCQ.objects.create(subject='physics', **question)
        self.stdout.write('Added Physics questions')

        for question in chemistry_questions:
            MCQ.objects.create(subject='chemistry', **question)
        self.stdout.write('Added Chemistry questions')

        for question in mathematics_questions:
            MCQ.objects.create(subject='mathematics', **question)
        self.stdout.write('Added Mathematics questions')

        self.stdout.write(self.style.SUCCESS('Successfully populated MCQs')) 