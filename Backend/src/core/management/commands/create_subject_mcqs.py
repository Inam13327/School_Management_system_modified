from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db import transaction
from ..models import Subject, MCQ, Test, StudentTest
import random

User = get_user_model()

class Command(BaseCommand):
    help = 'Create MCQs for subjects'

    def generate_mcq(self, subject_name, question_number):
        subjects = {
            'Physics': {
                'difficulty': ['easy', 'medium', 'hard'],
                'topics': [
                    'Mechanics', 'Thermodynamics', 'Electromagnetism',
                    'Optics', 'Modern Physics', 'Waves',
                    'Gravitation', 'Fluid Mechanics', 'Thermodynamics'
                ]
            },
            'Chemistry': {
                'difficulty': ['easy', 'medium', 'hard'],
                'topics': [
                    'Organic Chemistry', 'Inorganic Chemistry',
                    'Physical Chemistry', 'Analytical Chemistry',
                    'Biochemistry', 'Quantum Chemistry',
                    'Materials Chemistry', 'Environmental Chemistry'
                ]
            },
            'Mathematics': {
                'difficulty': ['easy', 'medium', 'hard'],
                'topics': [
                    'Algebra', 'Calculus', 'Geometry',
                    'Trigonometry', 'Statistics', 'Probability',
                    'Number Theory', 'Linear Algebra', 'Differential Equations'
                ]
            }
        }

        subject_data = subjects.get(subject_name)
        if not subject_data:
            return None

        topic = random.choice(subject_data['topics'])
        difficulty = random.choice(subject_data['difficulty'])

        # Generate question
        question = f"Q{question_number}: {topic} - {difficulty} difficulty"

        # Generate options
        options = [f"Option {chr(65+i)}" for i in range(4)]
        correct_option = random.choice(['A', 'B', 'C', 'D'])

        # Generate explanation
        explanation = f"Explanation for question {question_number} in {topic}"

        return {
            'question': question,
            'option_a': options[0],
            'option_b': options[1],
            'option_c': options[2],
            'option_d': options[3],
            'correct_option': correct_option,
            'explanation': explanation,
            'difficulty': difficulty
        }

    @transaction.atomic
    def handle(self, *args, **options):
        # Create or get subjects
        physics, _ = Subject.objects.get_or_create(name='Physics')
        chemistry, _ = Subject.objects.get_or_create(name='Chemistry')
        mathematics, _ = Subject.objects.get_or_create(name='Mathematics')

        # Create or get test
        test, _ = Test.objects.get_or_create(
            name='Subject Test',
            description='40-minute test with 100 MCQs per subject'
        )

        # Link subjects to test
        physics.test = test
        chemistry.test = test
        mathematics.test = test
        physics.save()
        chemistry.save()
        mathematics.save()

        # Create MCQs for each subject
        subjects = [physics, chemistry, mathematics]
        for subject in subjects:
            for i in range(1, 31):
                mcq_data = self.generate_mcq(subject.name, i)
                if mcq_data:
                    MCQ.objects.create(
                        subject=subject,
                        **mcq_data
                    )

        self.stdout.write(self.style.SUCCESS('Successfully created 30 MCQs for each subject'))
