from rest_framework import serializers
from .models import Class, Student, Attendance, Subject, Marks, Fee, ChangeRequest, ChangeRequestItem, MonthlyTest, TestMarks, UserProfile, PendingRegistration, EmailAccess
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.db.models import Sum, Avg, F, Count

class ClassSerializer(serializers.ModelSerializer):
    class Meta:
        model = Class
        fields = '__all__'

class StudentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Student
        fields = [
            'id', 'date_of_admission', 'serial_no', 'name', 'dob', 'dob_words', 'father_name',
            'tribe_or_caste', 'occupation', 'residence', 'class_admitted', 'age_at_admission',
            'class_withdrawn', 'date_of_withdrawal', 'remarks', 'pic', 'gender', 'is_archived', 'batch_no'
        ]

class SubjectSerializer(serializers.ModelSerializer):
    class_fk = ClassSerializer(read_only=True)
    class_fk_id = serializers.PrimaryKeyRelatedField(queryset=Class.objects.all(), source='class_fk', write_only=True)

    class Meta:
        model = Subject
        fields = ['id', 'name', 'class_fk', 'class_fk_id', 'created_at']

class MarksSerializer(serializers.ModelSerializer):
    student = StudentSerializer(read_only=True)
    student_id = serializers.PrimaryKeyRelatedField(queryset=Student.objects.all(), source='student', write_only=True)
    subject = SubjectSerializer(read_only=True)
    subject_id = serializers.PrimaryKeyRelatedField(queryset=Subject.objects.all(), source='subject', write_only=True)
    subject_name = serializers.CharField(source='subject.name', read_only=True)

    class Meta:
        model = Marks
        fields = ['id', 'student', 'student_id', 'subject', 'subject_id', 'subject_name', 'marks', 'created_at', 'updated_at']

class SubjectMarksSerializer(serializers.Serializer):
    """Serializer for subject marks within a student's marks data"""
    subject_name = serializers.CharField()
    marks = serializers.FloatField()
    total_marks = serializers.FloatField(default=100)
    percentage = serializers.FloatField()

class StudentMarksSerializer(serializers.Serializer):
    """Serializer for student marks with nested subject marks"""
    student_id = serializers.IntegerField()
    student_name = serializers.CharField()
    batch_no = serializers.CharField()
    subjects = SubjectMarksSerializer(many=True)
    total_obtained = serializers.FloatField()
    total_marks = serializers.FloatField()
    percentage = serializers.FloatField()

class ClassMarksSerializer(serializers.Serializer):
    """Serializer for class marks with nested student marks"""
    class_id = serializers.IntegerField()
    class_name = serializers.CharField()
    students = StudentMarksSerializer(many=True)

class AttendanceSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.name', read_only=True)
    
    class Meta:
        model = Attendance
        fields = ['id', 'student', 'student_name', 'date', 'present']

class FeeSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.name', read_only=True)
    class Meta:
        model = Fee
        fields = ['id', 'student', 'student_name', 'month', 'total_fee', 'submitted_fee', 'fine', 'absentees', 'created_at', 'updated_at']

class ChangeRequestItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChangeRequestItem
        fields = ['id', 'field_name', 'old_value', 'new_value']

class ChangeRequestSerializer(serializers.ModelSerializer):
    items = ChangeRequestItemSerializer(many=True, read_only=True)
    model_type_display = serializers.CharField(source='get_model_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    requested_by_username = serializers.CharField(source='requested_by.username', read_only=True)
    reviewed_by_username = serializers.CharField(source='reviewed_by.username', read_only=True)
    
    class Meta:
        model = ChangeRequest
        fields = [
            'id', 'model_type', 'model_type_display', 'object_id', 'requested_by', 
            'requested_by_username', 'requested_at', 'status', 'status_display', 
            'reviewed_by', 'reviewed_by_username', 'reviewed_at', 'notes', 'items'
        ]

class TestMarksSerializer(serializers.ModelSerializer):
    test = serializers.PrimaryKeyRelatedField(read_only=True)
    test_id = serializers.PrimaryKeyRelatedField(queryset=MonthlyTest.objects.all(), source='test', write_only=True)
    student = StudentSerializer(read_only=True)
    student_id = serializers.PrimaryKeyRelatedField(queryset=Student.objects.all(), source='student', write_only=True)
    student_name = serializers.CharField(source='student.name', read_only=True)
    
    class Meta:
        model = TestMarks
        fields = ['id', 'test', 'test_id', 'student', 'student_id', 'student_name', 'marks', 'total_marks', 'created_at', 'updated_at']

class MonthlyTestSerializer(serializers.ModelSerializer):
    class_fk = ClassSerializer(read_only=True)
    class_fk_id = serializers.PrimaryKeyRelatedField(queryset=Class.objects.all(), source='class_fk', write_only=True)
    test_marks = TestMarksSerializer(many=True, read_only=True)
    
    class Meta:
        model = MonthlyTest
        fields = ['id', 'title', 'subject', 'class_fk', 'class_fk_id', 'total_marks', 'description', 'month', 'created_at', 'updated_at', 'test_marks']

# ============================================================================
# NEW SERIALIZERS FOR USER REGISTRATION AND AUTHENTICATION
# ============================================================================

class UserRegistrationSerializer(serializers.ModelSerializer):
    """
    Serializer for user registration with admin approval requirement
    """
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password2 = serializers.CharField(write_only=True)
    requested_class = serializers.PrimaryKeyRelatedField(queryset=Class.objects.all(), required=False)
    
    class Meta:
        model = User
        fields = ('username', 'email', 'password', 'password2', 'first_name', 'last_name', 'requested_class')
        extra_kwargs = {
            'first_name': {'required': True},
            'last_name': {'required': True}
        }
    
    def validate(self, attrs):
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError({"password": "Password fields didn't match."})
        return attrs
    
    def create(self, validated_data):
        validated_data.pop('password2')
        requested_class = validated_data.pop('requested_class', None)
        
        # Create user as inactive (requires admin approval)
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password'],
            first_name=validated_data['first_name'],
            last_name=validated_data['last_name'],
            is_active=False  # User is not active until approved
        )
        
        # Update pending registration with requested class
        if hasattr(user, 'pending_registration') and requested_class:
            user.pending_registration.requested_class = requested_class
            user.pending_registration.save()
        
        return user

class UserLoginSerializer(serializers.Serializer):
    """
    Serializer for user login with approval check
    """
    email = serializers.EmailField()
    password = serializers.CharField()
    
    def validate(self, attrs):
        email = attrs.get('email')
        password = attrs.get('password')
        
        if email and password:
            # Try to authenticate with email
            try:
                user = User.objects.get(email=email)
                user = authenticate(username=user.username, password=password)
                if not user:
                    raise serializers.ValidationError('Invalid email or password.')
                if not user.is_active:
                    raise serializers.ValidationError('Your account is deactivated.')
                attrs['user'] = user
            except User.DoesNotExist:
                raise serializers.ValidationError('Invalid email or password.')
        else:
            raise serializers.ValidationError('Must include "email" and "password".')
        
        return attrs

class UserProfileSerializer(serializers.ModelSerializer):
    """
    Serializer for user profile with class assignment
    """
    user_email = serializers.CharField(source='user.email', read_only=True)
    user_username = serializers.CharField(source='user.username', read_only=True)
    assigned_class_name = serializers.CharField(source='assigned_class.name', read_only=True)
    approved_by_email = serializers.CharField(source='approved_by.email', read_only=True)
    
    class Meta:
        model = UserProfile
        fields = ('id', 'user_email', 'user_username', 'assigned_class', 'assigned_class_name', 
                 'is_approved', 'approved_by', 'approved_by_email', 'approved_at', 'created_at', 'updated_at')
        read_only_fields = ('id', 'user_email', 'user_username', 'is_approved', 'approved_by', 
                           'approved_by_email', 'approved_at', 'created_at', 'updated_at')

class PendingRegistrationSerializer(serializers.ModelSerializer):
    """
    Serializer for pending user registrations
    """
    user_email = serializers.CharField(source='user.email', read_only=True)
    user_username = serializers.CharField(source='user.username', read_only=True)
    user_first_name = serializers.CharField(source='user.first_name', read_only=True)
    user_last_name = serializers.CharField(source='user.last_name', read_only=True)
    requested_class_name = serializers.CharField(source='requested_class.name', read_only=True)
    
    class Meta:
        model = PendingRegistration
        fields = ('id', 'user', 'user_email', 'user_username', 'user_first_name', 'user_last_name',
                 'requested_class', 'requested_class_name', 'registration_date', 'notes')
        read_only_fields = ('id', 'user_email', 'user_username', 'user_first_name', 'user_last_name',
                           'registration_date')

class EmailAccessSerializer(serializers.ModelSerializer):
    """
    Serializer for email access management
    """
    user_email = serializers.CharField(source='user.email', read_only=True)
    assigned_class_name = serializers.CharField(source='assigned_class.name', read_only=True)
    
    class Meta:
        model = EmailAccess
        fields = ('id', 'user', 'user_email', 'email', 'assigned_class', 'assigned_class_name', 
                 'is_active', 'created_at', 'updated_at')
        read_only_fields = ('user', 'created_at', 'updated_at')
