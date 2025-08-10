from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone
from datetime import date


class Class(models.Model):
    name = models.CharField(max_length=100, unique=True)
   

    def __str__(self):
        return self.name

#from django.db import models



class Student(models.Model):
    date_of_admission = models.DateField(null=True, blank=True)
    serial_no = models.PositiveIntegerField(null=True, blank=True)
    name = models.CharField(max_length=100)
    dob = models.DateField(null=True, blank=True)
    dob_words = models.CharField(max_length=255, blank=True, null=True)
    father_name = models.CharField(max_length=100, null=True, blank=True)
    tribe_or_caste = models.CharField(max_length=100, blank=True, null=True)
    occupation = models.CharField(max_length=100, blank=True, null=True)
    residence = models.CharField(max_length=255, blank=True, null=True)
    class_admitted = models.CharField(max_length=50, blank=True, null=True)
    age_at_admission = models.CharField(max_length=20, blank=True, null=True)
    class_withdrawn = models.CharField(max_length=50, blank=True, null=True)
    date_of_withdrawal = models.DateField(null=True, blank=True)
    remarks = models.TextField(blank=True, null=True)
    pic = models.ImageField(upload_to='student_pics/', null=True, blank=True)
    gender = models.CharField(max_length=10, choices=[('boys', 'Boys'), ('girls', 'Girls')], default='boys')
    is_archived = models.BooleanField(default=False)
    batch_no = models.CharField(max_length=50, blank=True, null=True)

    def __str__(self):
        return f"{self.name} (Serial: {self.serial_no})"

class Subject(models.Model):
    name = models.CharField(max_length=100)
    class_fk = models.ForeignKey(Class, on_delete=models.CASCADE, related_name='subjects')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['name', 'class_fk']

    def __str__(self):
        return f"{self.name} - {self.class_fk.name}"

class Marks(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='marks')
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name='marks')
    marks = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['student', 'subject']

    def __str__(self):
        return f"{self.student.name} - {self.subject.name} - {self.marks}"

class Attendance(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='attendances')
    date = models.DateField()
    present = models.BooleanField()
    # Optionally, add class_fk and batch if needed
    # class_fk = models.ForeignKey(Class, on_delete=models.CASCADE, null=True, blank=True)
    # batch = models.CharField(max_length=50, null=True, blank=True)

    class Meta:
        unique_together = ['student', 'date']

    def __str__(self):
        return f"{self.student.name} - {self.date} - {'Present' if self.present else 'Absent'}"

class Fee(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='fees')
    month = models.DateField()  # Store the first day of the month
    total_fee = models.DecimalField(max_digits=10, decimal_places=2)
    submitted_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    fine = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    absentees = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['student', 'month']

    def __str__(self):
        return f"{self.student.name} - {self.month.strftime('%Y-%m')} - Fee"

# Change tracking models
class ChangeRequest(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]
    
    MODEL_CHOICES = [
        ('marks', 'Marks'),
        ('attendance', 'Attendance'),
        ('student', 'Student'),
        ('fee', 'Fee'),
        ('monthly_test', 'Monthly Test'),
        ('test_marks', 'Test Marks'),
    ]
    
    model_type = models.CharField(max_length=20, choices=MODEL_CHOICES)
    object_id = models.CharField(max_length=255, null=True, blank=True)
    requested_by = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
    requested_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    reviewed_by = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True, related_name='reviewed_changes')
    reviewed_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True, null=True)
    
    class Meta:
        ordering = ['-requested_at']
    
    def __str__(self):
        object_id_str = str(self.object_id) if self.object_id is not None else "N/A"
        return f"{self.get_model_type_display()} Change Request - {object_id_str} ({self.get_status_display()})"

class ChangeRequestItem(models.Model):
    change_request = models.ForeignKey(ChangeRequest, on_delete=models.CASCADE, related_name='items')
    field_name = models.CharField(max_length=100)
    old_value = models.TextField(blank=True, null=True)
    new_value = models.TextField(blank=True, null=True)
    
    def __str__(self):
        change_request_str = str(self.change_request) if self.change_request else "No Change Request"
        return f"{change_request_str} - {self.field_name}: {self.old_value} -> {self.new_value}"

class MonthlyTest(models.Model):
    title = models.CharField(max_length=200)
    subject = models.CharField(max_length=100)
    class_fk = models.ForeignKey(Class, on_delete=models.CASCADE, related_name='monthly_tests')
    total_marks = models.PositiveIntegerField(default=100)
    description = models.TextField(blank=True, null=True)
    month = models.DateField()  # Store the first day of the month
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['title', 'class_fk', 'month']

    def __str__(self):
        return f"{self.title} - {self.class_fk.name} - {self.month.strftime('%Y-%m')}"

class TestMarks(models.Model):
    test = models.ForeignKey(MonthlyTest, on_delete=models.CASCADE, related_name='test_marks')
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='test_marks')
    marks = models.DecimalField(max_digits=5, decimal_places=2)
    total_marks = models.PositiveIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['test', 'student']

    def __str__(self):
        return f"{self.student.name} - {self.test.title} - {self.marks}/{self.total_marks}"

# ============================================================================
# NEW MODELS FOR USER REGISTRATION AND CLASS-BASED PERMISSIONS
# ============================================================================

class UserProfile(models.Model):
    """
    Extended user profile model to store class assignments and approval status
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    assigned_class = models.ForeignKey(Class, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_users')
    is_approved = models.BooleanField(default=False)
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_users')
    approved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.user.email} - {self.assigned_class.name if self.assigned_class else 'No Class'}"
    
    class Meta:
        verbose_name = 'User Profile'
        verbose_name_plural = 'User Profiles'

class PendingRegistration(models.Model):
    """
    Model to track pending user registrations that need admin approval
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='pending_registration')
    requested_class = models.ForeignKey(Class, on_delete=models.SET_NULL, null=True, blank=True, related_name='pending_registrations')
    registration_date = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True, null=True)
    
    def __str__(self):
        return f"Pending: {self.user.email} - {self.requested_class.name if self.requested_class else 'No Class'}"
    
    class Meta:
        verbose_name = 'Email Address'
        verbose_name_plural = 'Email Addresses'

class EmailAccess(models.Model):
    """
    Model to manage email access and class assignments in admin panel
    """
    ROLE_CHOICES = [
        ('teacher', 'Teacher'),
        ('staff', 'Staff'),
        ('vice_principal', 'Vice Principal'),
    ]
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='email_access')
    email = models.EmailField(unique=True)
    assigned_class = models.ForeignKey(Class, on_delete=models.CASCADE, related_name='email_accesses', null=True, blank=True)
    assigned_classes = models.ManyToManyField(Class, related_name='teacher_accesses', blank=True)  # For teachers with multiple classes
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='teacher')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.user.email} - {self.role} - {self.assigned_class.name if self.assigned_class else 'No Class'}"
    
    class Meta:
        verbose_name = 'Email Access'
        verbose_name_plural = 'Email Access'



# ============================================================================
# SIGNALS FOR AUTOMATIC PROFILE CREATION AND APPROVAL LOGIC
# ============================================================================

@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    """
    Automatically create a UserProfile when a new User is created
    """
    if created:
        UserProfile.objects.create(user=instance)
        # If user is not staff/superuser, create pending registration
        if not instance.is_staff and not instance.is_superuser:
            PendingRegistration.objects.create(user=instance)

@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    """
    Automatically save the UserProfile when User is saved
    """
    if hasattr(instance, 'profile'):
        instance.profile.save()