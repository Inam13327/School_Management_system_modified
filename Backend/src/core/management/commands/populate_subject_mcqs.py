from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db import transaction
from ..models import Subject, MCQ, Test, StudentTest
import random

User = get_user_model()

class Command(BaseCommand):
    help = 'Create 100 MCQs for each subject'

    def generate_mcq(self, subject_name, question_number):
        # Generate random question
        question = f"Q{question_number}: What is the {random.choice(['correct', 'best', 'most accurate'])} answer about {subject_name} {random.randint(1, 100)}?"
        
        # Generate random options
        options = []
        for i in range(4):
            option = f"Option {chr(65+i)}: {random.choice(['True', 'False', 'Correct', 'Incorrect'])} statement about {subject_name}"
            options.append(option)
        
        # Shuffle options
        random.shuffle(options)
        
        # Choose random correct option
        correct_option = random.choice(['A', 'B', 'C', 'D'])
        
        # Generate explanation
        explanation = f"The correct answer is {correct_option}. This is because {random.choice(['it aligns with the fundamental principles', 'it follows the established rules', 'it is the most logical choice'])} of {subject_name}."
        
        return {
            'question': question,
            'option_a': options[0],
            'option_b': options[1],
            'option_c': options[2],
            'option_d': options[3],
            'correct_option': correct_option,
            'explanation': explanation,
            'difficulty': random.choice(['easy', 'medium', 'hard'])
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
                MCQ.objects.create(
                    subject=subject,
                    **mcq_data
                )

        self.stdout.write(self.style.SUCCESS('Successfully created 30 MCQs for each subject'))
