from rest_framework import viewsets, permissions
from .models import Class, Student, Attendance, Subject, Marks, Fee, ChangeRequest, ChangeRequestItem, MonthlyTest, TestMarks, UserProfile, PendingRegistration, EmailAccess
from .serializers import ClassSerializer, StudentSerializer, AttendanceSerializer, SubjectSerializer, MarksSerializer, FeeSerializer, ChangeRequestSerializer, MonthlyTestSerializer, TestMarksSerializer, UserRegistrationSerializer, UserLoginSerializer, UserProfileSerializer, PendingRegistrationSerializer, EmailAccessSerializer, ClassMarksSerializer, StudentMarksSerializer, SubjectMarksSerializer
from rest_framework.response import Response
from rest_framework import status
from django.db.models import Q, Sum, Avg, F, Count
from rest_framework.decorators import action
from .utils import create_change_request, get_object_data
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from django.utils import timezone

# ============================================================================
# CLASS-BASED PERMISSION MIXIN
# ============================================================================

class ClassBasedPermissionMixin:
    """
    Mixin to enforce class-based permissions for users
    """
    def get_queryset(self):
        queryset = super().get_queryset()
        # Admin users can see all data
        if self.request.user.is_staff:
            return queryset
        
        # Check if user has EmailAccess record to determine role
        try:
            email_access = EmailAccess.objects.get(user=self.request.user)
            user_role = email_access.role
        except EmailAccess.DoesNotExist:
            # Fallback to profile-based permissions
            if hasattr(self.request.user, 'profile') and self.request.user.profile.assigned_class:
                assigned_class = self.request.user.profile.assigned_class
                # Filter based on model type
                if hasattr(queryset.model, 'class_fk'):
                    queryset = queryset.filter(class_fk=assigned_class)
                elif hasattr(queryset.model, 'student'):
                    queryset = queryset.filter(student__class_admitted=assigned_class.name)
                elif hasattr(queryset.model, 'test'):
                    queryset = queryset.filter(test__class_fk=assigned_class)
            return queryset
        
        # Role-based permissions
        if user_role == 'vice_principal':
            # Vice Principal has access to all data
            return queryset
        elif user_role == 'staff':
            # Staff has access to all data for their functions (fees, reports, student data)
            return queryset
        elif user_role == 'teacher':
            # Teachers can only see data for their assigned class (single)
            assigned_class = email_access.assigned_class
            if assigned_class:
                if hasattr(queryset.model, 'class_fk'):
                    queryset = queryset.filter(class_fk=assigned_class)
                elif hasattr(queryset.model, 'student'):
                    queryset = queryset.filter(student__class_admitted=assigned_class.name)
                elif hasattr(queryset.model, 'test'):
                    queryset = queryset.filter(test__class_fk=assigned_class)
            else:
                return queryset.none()
        return queryset

class ClassViewSet(viewsets.ModelViewSet):
    queryset = Class.objects.all()
    serializer_class = ClassSerializer
    permission_classes = [permissions.AllowAny]

class StudentViewSet(viewsets.ModelViewSet, ClassBasedPermissionMixin):
    queryset = Student.objects.filter(is_archived=False)
    serializer_class = StudentSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        queryset = super().get_queryset()
        class_admitted = self.request.query_params.get('class_admitted')
        gender = self.request.query_params.get('gender')
        batch_no = self.request.query_params.get('batch_no')
        
        if class_admitted:
            queryset = queryset.filter(class_admitted=class_admitted)
        if gender:
            queryset = queryset.filter(gender=gender)
        if batch_no:
            queryset = queryset.filter(batch_no=batch_no)
            
        return queryset
        
    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.is_archived = True
        instance.save()
        return Response(status=204)

class SubjectViewSet(viewsets.ModelViewSet, ClassBasedPermissionMixin):
    queryset = Subject.objects.all()
    serializer_class = SubjectSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        queryset = super().get_queryset()
        class_fk = self.request.query_params.get('class_fk')
        if class_fk:
            queryset = queryset.filter(class_fk_id=class_fk)
        return queryset

    def create(self, request, *args, **kwargs):
        # Check if subject already exists for this class
        class_fk = request.data.get('class_fk_id')
        name = request.data.get('name')
        if class_fk and name:
            existing = Subject.objects.filter(class_fk_id=class_fk, name=name).first()
            if existing:
                return Response(
                    {'error': f'Subject "{name}" already exists for this class.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        return super().create(request, *args, **kwargs)

class MarksViewSet(viewsets.ModelViewSet, ClassBasedPermissionMixin):
    queryset = Marks.objects.all()
    serializer_class = MarksSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        queryset = super().get_queryset()
        student = self.request.query_params.get('student')
        subject = self.request.query_params.get('subject')
        class_fk = self.request.query_params.get('class_fk')
        
        if student:
            queryset = queryset.filter(student_id=student)
        if subject:
            queryset = queryset.filter(subject_id=subject)
        if class_fk:
            queryset = queryset.filter(subject__class_fk_id=class_fk)
        return queryset
    
    def list(self, request, *args, **kwargs):
        """
        Override list to include pending changes information
        """
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        data = serializer.data
        
        # Add pending changes information for each mark
        for mark_data in data:
            mark_id = mark_data.get('id')
            if mark_id:
                # Check for pending change requests
                pending_changes = ChangeRequest.objects.filter(
                    model_type='marks',
                    object_id=str(mark_id),
                    status='pending'
                ).first()
                
                if pending_changes:
                    # Get the new value from change request items
                    change_item = pending_changes.items.filter(field_name='marks').first()
                    if change_item:
                        mark_data['pending_marks'] = change_item.new_value
                        mark_data['has_pending_changes'] = True
                        mark_data['change_request_id'] = pending_changes.id
                    else:
                        mark_data['has_pending_changes'] = False
                else:
                    mark_data['has_pending_changes'] = False
        
        return Response(data)

    def create(self, request, *args, **kwargs):
        print(f"[DEBUG] MarksViewSet.create called")
        print(f"[DEBUG] Request data: {request.data}")
        print(f"[DEBUG] Request data type: {type(request.data)}")
        # Support bulk upsert (create or update)
        if isinstance(request.data, list):
            print(f"[DEBUG] Processing list of {len(request.data)} items")
            results = []
            for item in request.data:
                print(f"[DEBUG] Processing item: {item}")
                student_id = item.get('student_id')
                subject_id = item.get('subject_id')
                marks = item.get('marks')
                mark_id = item.get('id')
                print(f"[DEBUG] student_id={student_id}, subject_id={subject_id}, marks={marks}, mark_id={mark_id}")
                
                if mark_id:
                    # Update by id - requires approval
                    try:
                        mark = Marks.objects.get(id=mark_id)
                        old_data = {'marks': mark.marks}
                        new_data = {'marks': marks}
                        print(f"[DEBUG] Creating change request for existing mark id={mark_id}")
                        create_change_request('marks', mark.id, old_data, new_data, request.user)
                        results.append(mark)  # Return unchanged mark
                    except Marks.DoesNotExist:
                        print(f"[DEBUG] Marks with id={mark_id} does not exist")
                        continue
                else:
                    # Check if marks already exist for this student-subject combination
                    existing_mark = Marks.objects.filter(
                        student_id=student_id,
                        subject_id=subject_id
                    ).first()
                    
                    if existing_mark:
                        print(f"[DEBUG] Found existing mark for student_id={student_id}, subject_id={subject_id}, id={existing_mark.id}")
                        # Update existing marks - requires approval
                        old_data = {'marks': existing_mark.marks}
                        new_data = {'marks': marks}
                        create_change_request('marks', existing_mark.id, old_data, new_data, request.user)
                        results.append(existing_mark)  # Return unchanged mark
                    else:
                        print(f"[DEBUG] Creating new mark for student_id={student_id}, subject_id={subject_id}")
                        # First-time marks entry - save immediately
                        mark = Marks.objects.create(
                            student_id=student_id,
                            subject_id=subject_id,
                            marks=marks
                        )
                        results.append(mark)
            
            serializer = self.get_serializer(results, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)
        # Handle single mark creation
        print(f"[DEBUG] Processing single item")
        student_id = request.data.get('student_id')
        subject_id = request.data.get('subject_id')
        marks = request.data.get('marks')
        print(f"[DEBUG] student_id={student_id}, subject_id={subject_id}, marks={marks}")
        if student_id and subject_id:
            # Check if marks already exist
            existing_mark = Marks.objects.filter(
                student_id=student_id,
                subject_id=subject_id
            ).first()
            if existing_mark:
                print(f"[DEBUG] Found existing mark for student_id={student_id}, subject_id={subject_id}, id={existing_mark.id}")
                # Update existing marks - requires approval
                old_data = {'marks': existing_mark.marks}
                new_data = {'marks': marks}
                create_change_request('marks', existing_mark.id, old_data, new_data, request.user)
                return Response(self.get_serializer(existing_mark).data, status=status.HTTP_200_OK)
            else:
                print(f"[DEBUG] Creating new mark for student_id={student_id}, subject_id={subject_id}")
                # First-time marks entry - save immediately
                return super().create(request, *args, **kwargs)
        return super().create(request, *args, **kwargs)

    def perform_bulk_create(self, serializer):
        return Marks.objects.bulk_create([Marks(**item) for item in serializer.validated_data])

    def update(self, request, *args, **kwargs):
        # Support bulk update
        if isinstance(request.data, list):
            updated_marks = []
            for mark_data in request.data:
                mark_id = mark_data.get('id')
                if mark_id:
                    try:
                        mark = Marks.objects.get(id=mark_id)
                        old_data = {'marks': mark.marks}
                        new_data = {'marks': mark_data.get('marks')}
                        
                        # Create change request but don't save yet
                        create_change_request('marks', mark.id, old_data, new_data, request.user)
                        updated_marks.append(mark)  # Return unchanged mark
                    except Marks.DoesNotExist:
                        continue
            return Response({'message': f'Updated {len(updated_marks)} marks'}, status=status.HTTP_200_OK)
        
        # Handle individual mark update
        instance = self.get_object()
        old_data = {'marks': instance.marks}
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        new_data = {'marks': serializer.validated_data.get('marks', instance.marks)}
        
        # Create change request
        create_change_request('marks', instance.id, old_data, new_data, request.user)
        
        # Return the unchanged instance
        return Response(self.get_serializer(instance).data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='summary')
    def summary(self, request):
        student_id = request.query_params.get('student')
        class_fk = request.query_params.get('class_fk')
        if not student_id or not class_fk:
            return Response({'error': 'student and class_fk are required'}, status=400)
        # Get all subjects for the class
        subjects = Subject.objects.filter(class_fk_id=class_fk)
        subject_names = [s.name for s in subjects]
        # Get all marks for this student in this class
        marks = self.get_queryset().filter(student_id=student_id, subject__class_fk_id=class_fk)
        marks_map = {m.subject.name: float(m.marks or 0) for m in marks}
        
        # Calculate marks including pending changes
        pending_marks_map = {}
        for mark in marks:
            # Check for pending changes
            pending_changes = ChangeRequest.objects.filter(
                model_type='marks',
                object_id=str(mark.id),
                status='pending'
            ).first()
            
            if pending_changes:
                change_item = pending_changes.items.filter(field_name='marks').first()
                if change_item:
                    pending_marks_map[mark.subject.name] = float(change_item.new_value or 0)
        
        # Use pending marks if available, otherwise use current marks
        final_marks_map = {}
        for subject_name in subject_names:
            if subject_name in pending_marks_map:
                final_marks_map[subject_name] = pending_marks_map[subject_name]
            else:
                final_marks_map[subject_name] = marks_map.get(subject_name, 0)
        
        total_marks = len(subject_names) * 100
        obtained_marks = sum(final_marks_map.get(s, 0) for s in subject_names)
        percent = (obtained_marks / total_marks * 100) if total_marks > 0 else 0
        # Grade logic (match frontend)
        if percent >= 90:
            grade = 'A'
        elif percent >= 80:
            grade = 'B'
        elif percent >= 70:
            grade = 'C'
        elif percent >= 60:
            grade = 'D'
        else:
            grade = 'F'
        return Response({
            'classId': int(class_fk),
            'totalMarks': total_marks,
            'obtainedMarks': obtained_marks,
            'percent': percent,
            'grade': grade,
            'hasPendingChanges': len(pending_marks_map) > 0,
        })
        
    @action(detail=False, methods=['get'], url_path='class-marks')
    def class_marks(self, request):
        """Get marks for a class with nested structure by student and subject"""
        class_fk = request.query_params.get('class_fk')
        batch_no = request.query_params.get('batch_no')
        
        if not class_fk:
            return Response({'error': 'class_fk is required'}, status=400)
            
        try:
            class_obj = Class.objects.get(id=class_fk)
        except Class.DoesNotExist:
            return Response({'error': 'Class not found'}, status=404)
            
        # Get all students in this class
        students_query = Student.objects.filter(class_admitted=class_obj.name)
        
        # Apply batch filter if provided
        if batch_no:
            students_query = students_query.filter(batch_no=batch_no)
            
        students = students_query.all()
        
        # Get all subjects for this class
        subjects = Subject.objects.filter(class_fk=class_obj)
        subject_names = [s.name for s in subjects]
        subject_ids = [s.id for s in subjects]
        
        # Get all marks for these students and subjects
        marks = Marks.objects.filter(
            student__in=[s.id for s in students],
            subject__in=subject_ids
        ).select_related('student', 'subject')
        
        # Organize marks by student and subject
        marks_by_student = {}
        for mark in marks:
            student_id = mark.student.id
            if student_id not in marks_by_student:
                marks_by_student[student_id] = {}
            marks_by_student[student_id][mark.subject.name] = float(mark.marks or 0)
        
        # Build the response data structure
        students_data = []
        for student in students:
            # Get marks for this student
            student_marks = marks_by_student.get(student.id, {})
            
            # Calculate subject marks with percentages
            subject_marks_data = []
            total_obtained = 0
            total_possible = 0
            
            for subject_name in subject_names:
                mark_value = student_marks.get(subject_name, 0)
                total_marks = 100  # Default total marks per subject
                percentage = (mark_value / total_marks * 100) if total_marks > 0 else 0
                
                subject_marks_data.append({
                    'subject_name': subject_name,
                    'marks': mark_value,
                    'total_marks': total_marks,
                    'percentage': percentage
                })
                
                total_obtained += mark_value
                total_possible += total_marks
            
            # Calculate overall percentage
            overall_percentage = (total_obtained / total_possible * 100) if total_possible > 0 else 0
            
            # Add student data to the response
            students_data.append({
                'student_id': student.id,
                'student_name': student.name,
                'batch_no': student.batch_no or '',
                'subjects': subject_marks_data,
                'total_obtained': total_obtained,
                'total_marks': total_possible,
                'percentage': overall_percentage
            })
        
        # Create the final response
        response_data = {
            'class_id': class_obj.id,
            'class_name': class_obj.name,
            'students': students_data
        }
        
        serializer = ClassMarksSerializer(response_data)
        return Response(serializer.data)

class AttendanceViewSet(viewsets.ModelViewSet, ClassBasedPermissionMixin):
    queryset = Attendance.objects.all()
    serializer_class = AttendanceSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Filter by student class
        class_admitted = self.request.query_params.get('class_admitted') or self.request.query_params.get('student__class_admitted')
        if class_admitted:
            queryset = queryset.filter(student__class_admitted=class_admitted)
        
        # Filter by date
        date = self.request.query_params.get('date')
        if date:
            queryset = queryset.filter(date=date)
        
        # Filter by date year and month
        date_year = self.request.query_params.get('date__year')
        if date_year:
            queryset = queryset.filter(date__year=date_year)
        
        date_month = self.request.query_params.get('date__month')
        if date_month:
            queryset = queryset.filter(date__month=date_month)
        
        # Filter by student ID
        student = self.request.query_params.get('student')
        if student:
            if isinstance(student, list):
                queryset = queryset.filter(student_id__in=student)
            else:
                queryset = queryset.filter(student_id=student)
        
        return queryset

    def create(self, request, *args, **kwargs):
        # Support bulk create/update
        if isinstance(request.data, list):
            serializer = self.get_serializer(data=request.data, many=True)
            serializer.is_valid(raise_exception=True)
            results = self.perform_bulk_upsert(serializer.validated_data)
            result_serializer = self.get_serializer(results, many=True)
            headers = self.get_success_headers(result_serializer.data)
            return Response(result_serializer.data, status=status.HTTP_200_OK, headers=headers)
        return super().create(request, *args, **kwargs)

    def perform_bulk_upsert(self, validated_data):
        results = []
        for item in validated_data:
            # Check if attendance record exists
            try:
                existing_attendance = Attendance.objects.get(
                    student=item['student'],
                    date=item['date']
                )
                # This is an update - create change request but don't save yet
                old_data = {'present': existing_attendance.present}
                new_data = {'present': item['present']}
                change_request = create_change_request('attendance', existing_attendance.id, old_data, new_data, self.request.user)
                
                # Return the existing record (unchanged) for now
                results.append(existing_attendance)
            except Attendance.DoesNotExist:
                # This is a new record - create it immediately
                attendance = Attendance.objects.create(
                    student=item['student'],
                    date=item['date'],
                    present=item['present']
                )
                results.append(attendance)
        return results

    def list(self, request, *args, **kwargs):
        status_param = request.query_params.get('status')
        date = request.query_params.get('date')
        class_admitted = request.query_params.get('class_admitted') or request.query_params.get('student__class_admitted')
        queryset = self.filter_queryset(self.get_queryset())
        if status_param in ['absent', 'present'] and date and class_admitted:
            # Get all students in the class
            students = Student.objects.filter(class_admitted=class_admitted)
            att_qs = Attendance.objects.filter(date=date, student__class_admitted=class_admitted)
            if status_param == 'present':
                att_qs = att_qs.filter(present=True)
                return Response(self.get_serializer(att_qs, many=True).data)
            elif status_param == 'absent':
                present_ids = att_qs.filter(present=True).values_list('student_id', flat=True)
                absent_students = students.exclude(id__in=present_ids)
                # Return as a list of dicts for frontend
                return Response([
                    {'id': s.id, 'name': s.name, 'father_name': s.father_name, 'serial_no': s.serial_no, 'class_admitted': s.class_admitted}
                    for s in absent_students
                ])
        return super().list(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        """Handle individual attendance record updates"""
        instance = self.get_object()
        
        # Get the old data before any changes
        old_data = {'present': instance.present}
        
        # Create change request for the update
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        
        # Get the new data from the serializer
        new_data = {'present': serializer.validated_data.get('present', instance.present)}
        
        # Create change request
        change_request = create_change_request('attendance', instance.id, old_data, new_data, request.user)
        
        # Return the unchanged instance for now
        return Response(self.get_serializer(instance).data, status=status.HTTP_200_OK)

class FeeViewSet(viewsets.ModelViewSet, ClassBasedPermissionMixin):
    queryset = Fee.objects.all()
    serializer_class = FeeSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        queryset = super().get_queryset()
        student = self.request.query_params.get('student')
        class_admitted = self.request.query_params.get('class_admitted')
        month = self.request.query_params.get('month')
        if student:
            queryset = queryset.filter(student_id=student)
        if class_admitted:
            queryset = queryset.filter(student__class_admitted=class_admitted)
        if month:
            queryset = queryset.filter(month=month)
        return queryset

    def create(self, request, *args, **kwargs):
        # Support bulk upsert (create or update)
        if isinstance(request.data, list):
            results = []
            for item in request.data:
                student_id = item.get('student')
                month = item.get('month')
                total_fee = item.get('total_fee', 0)
                submitted_fee = item.get('submitted_fee', 0)
                absentees = item.get('absentees', 0)
                # Support fine_per_absent from frontend
                fine_per_absent = item.get('fine_per_absent')
                if fine_per_absent is not None:
                    fine = absentees * float(fine_per_absent)
                else:
                    fine = item.get('fine', 0)
                fee_id = item.get('id')
                if fee_id:
                    # Update by id
                    try:
                        fee = Fee.objects.get(id=fee_id)
                        old_data = {
                            'total_fee': fee.total_fee,
                            'submitted_fee': fee.submitted_fee,
                            'fine': fee.fine,
                            'absentees': fee.absentees
                        }
                        new_data = {
                            'total_fee': total_fee,
                            'submitted_fee': submitted_fee,
                            'fine': fine,
                            'absentees': absentees
                        }
                        # Create change request but don't save yet
                        create_change_request('fee', fee.id, old_data, new_data, request.user)
                        results.append(fee)  # Return unchanged fee
                    except Fee.DoesNotExist:
                        continue
                else:
                    # Check if fee exists for this student/month
                    try:
                        existing_fee = Fee.objects.get(student_id=student_id, month=month)
                        # This is an update - create change request
                        old_data = {
                            'total_fee': existing_fee.total_fee,
                            'submitted_fee': existing_fee.submitted_fee,
                            'fine': existing_fee.fine,
                            'absentees': existing_fee.absentees
                        }
                        new_data = {
                            'total_fee': total_fee,
                            'submitted_fee': submitted_fee,
                            'fine': fine,
                            'absentees': absentees
                        }
                        create_change_request('fee', existing_fee.id, old_data, new_data, request.user)
                        results.append(existing_fee)  # Return unchanged fee
                    except Fee.DoesNotExist:
                        # This is a new record - create it immediately
                        fee = Fee.objects.create(
                            student_id=student_id,
                            month=month,
                            total_fee=total_fee,
                            submitted_fee=submitted_fee,
                            fine=fine,
                            absentees=absentees
                        )
                        results.append(fee)
            serializer = self.get_serializer(results, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        # Support bulk update
        if isinstance(request.data, list):
            updated_fees = []
            for fee_data in request.data:
                fee_id = fee_data.get('id')
                absentees = fee_data.get('absentees', 0)
                fine_per_absent = fee_data.get('fine_per_absent')
                if fine_per_absent is not None:
                    fine = absentees * float(fine_per_absent)
                else:
                    fine = fee_data.get('fine', 0)
                if fee_id:
                    try:
                        fee = Fee.objects.get(id=fee_id)
                        old_data = {
                            'total_fee': fee.total_fee,
                            'submitted_fee': fee.submitted_fee,
                            'fine': fee.fine,
                            'absentees': fee.absentees
                        }
                        new_data = {
                            'total_fee': fee_data.get('total_fee', fee.total_fee),
                            'submitted_fee': fee_data.get('submitted_fee', fee.submitted_fee),
                            'fine': fine,
                            'absentees': absentees
                        }
                        # Create change request but don't save yet
                        create_change_request('fee', fee.id, old_data, new_data, request.user)
                        updated_fees.append(fee)  # Return unchanged fee
                    except Fee.DoesNotExist:
                        continue
            return Response({'message': f'Updated {len(updated_fees)} fees'}, status=status.HTTP_200_OK)
        
        # Handle individual fee update
        instance = self.get_object()
        old_data = {
            'total_fee': instance.total_fee,
            'submitted_fee': instance.submitted_fee,
            'fine': instance.fine,
            'absentees': instance.absentees
        }
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        new_data = {
            'total_fee': serializer.validated_data.get('total_fee', instance.total_fee),
            'submitted_fee': serializer.validated_data.get('submitted_fee', instance.submitted_fee),
            'fine': serializer.validated_data.get('fine', instance.fine),
            'absentees': serializer.validated_data.get('absentees', instance.absentees)
        }
        
        # Create change request
        create_change_request('fee', instance.id, old_data, new_data, request.user)
        
        # Return the unchanged instance
        return Response(self.get_serializer(instance).data, status=status.HTTP_200_OK)

class ChangeRequestViewSet(viewsets.ModelViewSet):
    queryset = ChangeRequest.objects.all()
    serializer_class = ChangeRequestSerializer
    permission_classes = [permissions.AllowAny]
    
    def get_queryset(self):
        queryset = super().get_queryset()
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        return queryset
    
    @action(detail=False, methods=['get'], url_path='pending-count')
    def pending_count(self, request):
        """Get count of pending change requests"""
        count = ChangeRequest.objects.filter(status='pending').count()
        return Response({'pending_count': count})
    
    @action(detail=False, methods=['get'], url_path='pending')
    def pending(self, request):
        """Get all pending change requests with detailed information"""
        queryset = ChangeRequest.objects.filter(status='pending').order_by('-requested_at')
        
        # Add detailed information for each pending request
        detailed_data = []
        for change_request in queryset:
            try:
                if change_request.model_type == 'marks':
                    marks = Marks.objects.get(id=change_request.object_id)
                    student_name = marks.student.name
                    subject_name = marks.subject.name
                    class_name = marks.student.class_admitted or "Unknown"
                    details = f"{student_name} - {subject_name}"
                elif change_request.model_type == 'attendance':
                    attendance = Attendance.objects.get(id=change_request.object_id)
                    student_name = attendance.student.name
                    class_name = attendance.student.class_admitted or "Unknown"
                    details = f"{student_name} - {attendance.date}"
                elif change_request.model_type == 'student':
                    student = Student.objects.get(id=change_request.object_id)
                    student_name = student.name
                    class_name = student.class_admitted or "Unknown"
                    details = f"{student_name}"
                elif change_request.model_type == 'fee':
                    fee = Fee.objects.get(id=change_request.object_id)
                    student_name = fee.student.name
                    class_name = fee.student.class_admitted or "Unknown"
                    details = f"{student_name} - {fee.month.strftime('%Y-%m')}"
                elif change_request.model_type == 'monthly_test':
                    test = MonthlyTest.objects.get(id=change_request.object_id)
                    class_name = test.class_fk.name
                    details = f"{test.title} - {test.subject}"
                elif change_request.model_type == 'test_marks':
                    # Parse object_id as "test_id_student_id"
                    parts = str(change_request.object_id).split('_')
                    if len(parts) == 2:
                        test_id, student_id = parts
                        test = MonthlyTest.objects.get(id=test_id)
                        student = Student.objects.get(id=student_id)
                        class_name = student.class_admitted or "Unknown"
                        details = f"{student.name} - {test.title} ({test.subject})"
                    else:
                        details = f"Test Marks (ID: {change_request.object_id})"
                        class_name = "Unknown"
                else:
                    details = f"ID: {change_request.object_id}"
                    class_name = "Unknown"
                
                # Get change items
                change_items = []
                for item in change_request.items.all():
                    change_items.append({
                        'field_name': item.field_name,
                        'old_value': item.old_value,
                        'new_value': item.new_value
                    })
                
                detailed_data.append({
                    'id': change_request.id,
                    'model_type': change_request.model_type,
                    'object_id': change_request.object_id,
                    'details': details,
                    'class_name': class_name,
                    'requested_by': change_request.requested_by.username if change_request.requested_by else 'Frontend User',
                    'requested_at': change_request.requested_at,
                    'notes': change_request.notes,
                    'change_items': change_items
                })
            except (Marks.DoesNotExist, Attendance.DoesNotExist, Student.DoesNotExist, Fee.DoesNotExist, MonthlyTest.DoesNotExist):
                # Handle case where the object no longer exists
                detailed_data.append({
                    'id': change_request.id,
                    'model_type': change_request.model_type,
                    'object_id': change_request.object_id,
                    'details': f"Record not found (ID: {change_request.object_id})",
                    'class_name': "Unknown",
                    'requested_by': change_request.requested_by.username if change_request.requested_by else 'Frontend User',
                    'requested_at': change_request.requested_at,
                    'notes': change_request.notes,
                    'change_items': []
                })
        
        return Response({
            'pending_count': len(detailed_data),
            'pending_requests': detailed_data
        })
    
    @action(detail=False, methods=['get'], url_path='by-object')
    def by_object(self, request):
        """Get change requests for a specific object"""
        model_type = request.query_params.get('model_type')
        object_id = request.query_params.get('object_id')
        
        if not model_type or not object_id:
            return Response({'error': 'model_type and object_id are required'}, status=400)
        
        queryset = ChangeRequest.objects.filter(
            model_type=model_type,
            object_id=object_id,
            status='pending'
        )
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'], url_path='rejected')
    def rejected(self, request):
        """Get all rejected change requests with detailed information"""
        queryset = ChangeRequest.objects.filter(status='rejected').order_by('-requested_at')
        
        # Add detailed information for each rejected request
        detailed_data = []
        for change_request in queryset:
            try:
                if change_request.model_type == 'marks':
                    marks = Marks.objects.get(id=change_request.object_id)
                    student_name = marks.student.name
                    subject_name = marks.subject.name
                    class_name = marks.student.class_admitted or "Unknown"
                    details = f"{student_name} - {subject_name}"
                elif change_request.model_type == 'attendance':
                    attendance = Attendance.objects.get(id=change_request.object_id)
                    student_name = attendance.student.name
                    class_name = attendance.student.class_admitted or "Unknown"
                    details = f"{student_name} - {attendance.date}"
                elif change_request.model_type == 'student':
                    student = Student.objects.get(id=change_request.object_id)
                    student_name = student.name
                    class_name = student.class_admitted or "Unknown"
                    details = f"{student_name}"
                elif change_request.model_type == 'fee':
                    fee = Fee.objects.get(id=change_request.object_id)
                    student_name = fee.student.name
                    class_name = fee.student.class_admitted or "Unknown"
                    details = f"{student_name} - {fee.month.strftime('%Y-%m')}"
                elif change_request.model_type == 'monthly_test':
                    test = MonthlyTest.objects.get(id=change_request.object_id)
                    class_name = test.class_fk.name
                    details = f"{test.title} - {test.subject}"
                elif change_request.model_type == 'test_marks':
                    # Parse object_id as "test_id_student_id"
                    parts = str(change_request.object_id).split('_')
                    if len(parts) == 2:
                        test_id, student_id = parts
                        test = MonthlyTest.objects.get(id=test_id)
                        student = Student.objects.get(id=student_id)
                        class_name = student.class_admitted or "Unknown"
                        details = f"{student.name} - {test.title} ({test.subject})"
                    else:
                        details = f"Test Marks (ID: {change_request.object_id})"
                        class_name = "Unknown"
                else:
                    details = f"ID: {change_request.object_id}"
                    class_name = "Unknown"
                
                # Get change items
                change_items = []
                for item in change_request.items.all():
                    change_items.append({
                        'field_name': item.field_name,
                        'old_value': item.old_value,
                        'new_value': item.new_value
                    })
                
                detailed_data.append({
                    'id': change_request.id,
                    'model_type': change_request.model_type,
                    'object_id': change_request.object_id,
                    'details': details,
                    'class_name': class_name,
                    'requested_by': change_request.requested_by.username if change_request.requested_by else 'Frontend User',
                    'requested_at': change_request.requested_at,
                    'reviewed_by': change_request.reviewed_by.username if change_request.reviewed_by else 'Unknown',
                    'reviewed_at': change_request.reviewed_at,
                    'notes': change_request.notes,
                    'change_items': change_items
                })
            except (Marks.DoesNotExist, Attendance.DoesNotExist, Student.DoesNotExist, Fee.DoesNotExist, MonthlyTest.DoesNotExist):
                # Handle case where the object no longer exists
                detailed_data.append({
                    'id': change_request.id,
                    'model_type': change_request.model_type,
                    'object_id': change_request.object_id,
                    'details': f"Record not found (ID: {change_request.object_id})",
                    'class_name': "Unknown",
                    'requested_by': change_request.requested_by.username if change_request.requested_by else 'Frontend User',
                    'requested_at': change_request.requested_at,
                    'reviewed_by': change_request.reviewed_by.username if change_request.reviewed_by else 'Unknown',
                    'reviewed_at': change_request.reviewed_at,
                    'notes': change_request.notes,
                    'change_items': []
                })
        
        return Response({
            'rejected_count': len(detailed_data),
            'rejected_requests': detailed_data
        })
    
    @action(detail=False, methods=['get'], url_path='approved')
    def approved(self, request):
        """Get all approved change requests with detailed information"""
        queryset = ChangeRequest.objects.filter(status='approved').order_by('-requested_at')
        
        # Add detailed information for each approved request
        detailed_data = []
        for change_request in queryset:
            try:
                if change_request.model_type == 'marks':
                    marks = Marks.objects.get(id=change_request.object_id)
                    student_name = marks.student.name
                    subject_name = marks.subject.name
                    class_name = marks.student.class_admitted or "Unknown"
                    details = f"{student_name} - {subject_name}"
                elif change_request.model_type == 'attendance':
                    attendance = Attendance.objects.get(id=change_request.object_id)
                    student_name = attendance.student.name
                    class_name = attendance.student.class_admitted or "Unknown"
                    details = f"{student_name} - {attendance.date}"
                elif change_request.model_type == 'student':
                    student = Student.objects.get(id=change_request.object_id)
                    student_name = student.name
                    class_name = student.class_admitted or "Unknown"
                    details = f"{student_name}"
                elif change_request.model_type == 'fee':
                    fee = Fee.objects.get(id=change_request.object_id)
                    student_name = fee.student.name
                    class_name = fee.student.class_admitted or "Unknown"
                    details = f"{student_name} - {fee.month.strftime('%Y-%m')}"
                elif change_request.model_type == 'monthly_test':
                    test = MonthlyTest.objects.get(id=change_request.object_id)
                    class_name = test.class_fk.name
                    details = f"{test.title} - {test.subject}"
                elif change_request.model_type == 'test_marks':
                    # Parse object_id as "test_id_student_id"
                    parts = str(change_request.object_id).split('_')
                    if len(parts) == 2:
                        test_id, student_id = parts
                        test = MonthlyTest.objects.get(id=test_id)
                        student = Student.objects.get(id=student_id)
                        class_name = student.class_admitted or "Unknown"
                        details = f"{student.name} - {test.title} ({test.subject})"
                    else:
                        details = f"Test Marks (ID: {change_request.object_id})"
                        class_name = "Unknown"
                else:
                    details = f"ID: {change_request.object_id}"
                    class_name = "Unknown"
                
                # Get change items
                change_items = []
                for item in change_request.items.all():
                    change_items.append({
                        'field_name': item.field_name,
                        'old_value': item.old_value,
                        'new_value': item.new_value
                    })
                
                detailed_data.append({
                    'id': change_request.id,
                    'model_type': change_request.model_type,
                    'object_id': change_request.object_id,
                    'details': details,
                    'class_name': class_name,
                    'requested_by': change_request.requested_by.username if change_request.requested_by else 'Frontend User',
                    'requested_at': change_request.requested_at,
                    'reviewed_by': change_request.reviewed_by.username if change_request.reviewed_by else 'Unknown',
                    'reviewed_at': change_request.reviewed_at,
                    'notes': change_request.notes,
                    'change_items': change_items
                })
            except (Marks.DoesNotExist, Attendance.DoesNotExist, Student.DoesNotExist, Fee.DoesNotExist, MonthlyTest.DoesNotExist):
                # Handle case where the object no longer exists
                detailed_data.append({
                    'id': change_request.id,
                    'model_type': change_request.model_type,
                    'object_id': change_request.object_id,
                    'details': f"Record not found (ID: {change_request.object_id})",
                    'class_name': "Unknown",
                    'requested_by': change_request.requested_by.username if change_request.requested_by else 'Frontend User',
                    'requested_at': change_request.requested_at,
                    'reviewed_by': change_request.reviewed_by.username if change_request.reviewed_by else 'Unknown',
                    'reviewed_at': change_request.reviewed_at,
                    'notes': change_request.notes,
                    'change_items': []
                })
        
        return Response({
            'approved_count': len(detailed_data),
            'approved_requests': detailed_data
        })
    
    @action(detail=False, methods=['get'], url_path='summary')
    def summary(self, request):
        """Get summary of all change requests by status"""
        pending_count = ChangeRequest.objects.filter(status='pending').count()
        approved_count = ChangeRequest.objects.filter(status='approved').count()
        rejected_count = ChangeRequest.objects.filter(status='rejected').count()
        total_count = ChangeRequest.objects.count()
        
        return Response({
            'total_count': total_count,
            'pending_count': pending_count,
            'approved_count': approved_count,
            'rejected_count': rejected_count,
            'summary': {
                'total': total_count,
                'pending': pending_count,
                'approved': approved_count,
                'rejected': rejected_count
            }
        })
    
    def create(self, request, *args, **kwargs):
        """Override create to add validation for change requests"""
        print("[DEBUG] Received create change request API call")
        print(f"[DEBUG] Request data: {request.data}")
        model_type = request.data.get('model_type')
        object_id = request.data.get('object_id')
        old_data = request.data.get('old_data', {})
        new_data = request.data.get('new_data', {})
        print(f"[DEBUG] model_type: {model_type}, object_id: {object_id}")
        print(f"[DEBUG] old_data: {old_data}")
        print(f"[DEBUG] new_data: {new_data}")
        
        # Validate that we have the required data
        if not model_type or not object_id:
            print("[DEBUG] Missing model_type or object_id")
            return Response({
                'error': 'model_type and object_id are required'
            }, status=400)
        
        # Check if there are any actual changes
        changed_fields = []
        for field_name, new_value in new_data.items():
            if field_name in old_data and str(old_data[field_name]) != str(new_value):
                changed_fields.append({
                    'field_name': field_name,
                    'old_value': str(old_data[field_name]) if old_data[field_name] is not None else '',
                    'new_value': str(new_value) if new_value is not None else ''
                })
        print(f"[DEBUG] changed_fields: {changed_fields}")
        
        if not changed_fields:
            print("[DEBUG] No changes detected between old and new data")
            return Response({
                'error': 'No changes detected between old and new data',
                'message': 'No change request created because there are no actual changes'
            }, status=400)
        
        # Create the change request using the utility function
        change_request = create_change_request(model_type, object_id, old_data, new_data, request.user)
        
        if change_request:
            print(f"[DEBUG] Successfully created change request ID: {change_request.id}")
            serializer = self.get_serializer(change_request)
            return Response(serializer.data, status=201)
        else:
            print("[DEBUG] Failed to create change request")
            return Response({
                'error': 'Failed to create change request'
            }, status=500)

class MonthlyTestViewSet(viewsets.ModelViewSet, ClassBasedPermissionMixin):
    queryset = MonthlyTest.objects.all()
    serializer_class = MonthlyTestSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        queryset = super().get_queryset()
        class_fk = self.request.query_params.get('class_fk')
        month = self.request.query_params.get('month')
        
        if class_fk:
            queryset = queryset.filter(class_fk_id=class_fk)
        if month:
            queryset = queryset.filter(month=month)
            
        return queryset

class TestMarksViewSet(viewsets.ModelViewSet, ClassBasedPermissionMixin):
    queryset = TestMarks.objects.all()
    serializer_class = TestMarksSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        queryset = super().get_queryset()
        test = self.request.query_params.get('test')
        student = self.request.query_params.get('student')
        
        if test:
            queryset = queryset.filter(test_id=test)
        if student:
            queryset = queryset.filter(student_id=student)
        
        # Add debugging to verify marks data
        print(f"TestMarksViewSet - Query params: test={test}, student={student}")
        for mark in queryset:
            print(f"TestMarks ID: {mark.id}, Student: {mark.student.name}, Marks: {mark.marks}, Total: {mark.total_marks}")
            
        return queryset

    def list(self, request, *args, **kwargs):
        """
        Override list to include pending changes information
        """
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        data = serializer.data
        
        # Add pending changes information for each test mark
        for mark_data in data:
            mark_id = mark_data.get('id')
            if mark_id:
                # Check for pending change requests
                pending_changes = ChangeRequest.objects.filter(
                    model_type='test_marks',
                    object_id=str(mark_id),
                    status='pending'
                ).first()
                
                if pending_changes:
                    # Get the new value from change request items
                    change_item = pending_changes.items.filter(field_name='marks').first()
                    if change_item:
                        mark_data['pending_marks'] = change_item.new_value
                        mark_data['has_pending_changes'] = True
                        mark_data['change_request_id'] = pending_changes.id
                    else:
                        mark_data['has_pending_changes'] = False
                else:
                    mark_data['has_pending_changes'] = False
        
        return Response(data)

    def create(self, request, *args, **kwargs):
        # Support bulk upsert (create or update)
        print(f"[DEBUG] TestMarksViewSet.create called")
        print(f"[DEBUG] Request data: {request.data}")
        print(f"[DEBUG] Request data type: {type(request.data)}")
        
        if isinstance(request.data, list):
            print(f"[DEBUG] Processing list of {len(request.data)} items")
            results = []
            for item in request.data:
                test_id = item.get('test_id')
                student_id = item.get('student_id')
                marks = item.get('marks')
                total_marks = item.get('total_marks')
                
                print(f"[DEBUG] Processing item: test_id={test_id}, student_id={student_id}, marks={marks}")
                
                # Check if marks already exist for this test-student combination
                existing_mark = TestMarks.objects.filter(
                    test_id=test_id,
                    student_id=student_id
                ).first()
                
                if existing_mark:
                    # Update existing marks - requires approval
                    old_data = {'marks': existing_mark.marks}
                    new_data = {'marks': marks}
                    print(f"[DEBUG] Found existing TestMarks ID: {existing_mark.id}")
                    print(f"[DEBUG] Creating change request with object_id: {existing_mark.id}")
                    print(f"[DEBUG] Object ID type: {type(existing_mark.id)}")
                    create_change_request('test_marks', str(existing_mark.id), old_data, new_data, request.user)
                    results.append(existing_mark)  # Return unchanged mark
                else:
                    print(f"[DEBUG] No existing TestMarks found for test_id={test_id}, student_id={student_id}")
                    # First-time marks entry - save immediately
                    mark = TestMarks.objects.create(
                        test_id=test_id,
                        student_id=student_id,
                        marks=marks,
                        total_marks=total_marks
                    )
                    results.append(mark)
            
            serializer = self.get_serializer(results, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)
        else:
            print(f"[DEBUG] Processing single item")
            # Handle single mark creation
            return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        # Support bulk update
        if isinstance(request.data, list):
            updated_marks = []
            for mark_data in request.data:
                mark_id = mark_data.get('id')
                if mark_id:
                    try:
                        mark = TestMarks.objects.get(id=mark_id)
                        old_data = {'marks': mark.marks}
                        new_data = {'marks': mark_data.get('marks')}
                        
                        # Create change request but don't save yet
                        create_change_request('test_marks', mark.id, old_data, new_data, request.user)
                        updated_marks.append(mark)  # Return unchanged mark
                    except TestMarks.DoesNotExist:
                        continue
            return Response({'message': f'Updated {len(updated_marks)} test marks'}, status=status.HTTP_200_OK)
        
        # Handle individual mark update
        instance = self.get_object()
        old_data = {'marks': instance.marks}
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        new_data = {'marks': serializer.validated_data.get('marks', instance.marks)}
        
        # Create change request
        create_change_request('test_marks', instance.id, old_data, new_data, request.user)
        
        # Return the unchanged instance
        return Response(self.get_serializer(instance).data, status=status.HTTP_200_OK)
    
# ============================================================================
# NEW VIEWS FOR USER REGISTRATION AND AUTHENTICATION
# ============================================================================

class UserRegistrationView(APIView):
    """
    View for user registration with admin approval requirement
    """
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        serializer = UserRegistrationSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            return Response({
                'message': 'Registration successful! Your account is pending admin approval.',
                'user_id': user.id
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class UserLoginView(APIView):
    """
    View for user login with approval check and role-based permissions
    """
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        serializer = UserLoginSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.validated_data['user']
            
            # Get user's role and assigned classes
            role = 'user'  # default
            assigned_classes = []
            
            try:
                email_access = EmailAccess.objects.get(user=user)
                role = email_access.role
                if role == 'teacher':
                    if email_access.assigned_class:
                        assigned_class_obj = {'id': email_access.assigned_class.id, 'name': email_access.assigned_class.name}
                        assigned_classes = [assigned_class_obj]
                        assigned_class = assigned_class_obj
                    else:
                        assigned_classes = []
                        assigned_class = None
                elif role == 'vice_principal':
                    from .models import Class
                    assigned_classes = [
                        {'id': cls.id, 'name': cls.name}
                        for cls in Class.objects.all()
                    ]
                    assigned_class = None
                else:
                    assigned_class = None
            except EmailAccess.DoesNotExist:
                role = 'user'
                assigned_class = None
                assigned_classes = []
            # Generate JWT tokens
            refresh = RefreshToken.for_user(user)
            return Response({
                'message': 'Login successful!',
                'tokens': {
                    'access': str(refresh.access_token),
                    'refresh': str(refresh)
                },
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'email': user.email,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'is_approved': user.profile.is_approved if hasattr(user, 'profile') else False,
                    'assigned_class': assigned_class,
                    'role': role,
                    'assigned_classes': assigned_classes
                }
            }, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class UserProfileViewSet(viewsets.ModelViewSet):
    """
    ViewSet for user profile management
    """
    queryset = UserProfile.objects.all()
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        # Users can only see their own profile
        if self.request.user.is_staff:
            return UserProfile.objects.all()
        return UserProfile.objects.filter(user=self.request.user)

class PendingRegistrationViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing pending user registrations (admin only)
    """
    queryset = PendingRegistration.objects.all()
    serializer_class = PendingRegistrationSerializer
    permission_classes = [permissions.IsAdminUser]
    
    @action(detail=True, methods=['post'], url_path='approve')
    def approve(self, request, pk=None):
        """
        Approve a pending registration and assign class
        """
        pending_reg = self.get_object()
        assigned_class_id = request.data.get('assigned_class')
        
        if not assigned_class_id:
            return Response({'error': 'assigned_class is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            assigned_class = Class.objects.get(id=assigned_class_id)
        except Class.DoesNotExist:
            return Response({'error': 'Invalid class ID'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Activate user and assign class
        user = pending_reg.user
        user.is_active = True
        user.save()
        
        # Update user profile
        user.profile.is_approved = True
        user.profile.assigned_class = assigned_class
        user.profile.approved_by = request.user
        user.profile.approved_at = timezone.now()
        user.profile.save()
        
        # Create EmailAccess record
        EmailAccess.objects.create(
            user=user,
            email=user.email,
            assigned_class=assigned_class
        )
        
        # Delete pending registration
        pending_reg.delete()
        
        return Response({
            'message': f'User {user.email} approved and assigned to {assigned_class.name}'
        }, status=status.HTTP_200_OK)
    
    @action(detail=True, methods=['post'], url_path='reject')
    def reject(self, request, pk=None):
        """
        Reject a pending registration
        """
        pending_reg = self.get_object()
        user = pending_reg.user
        
        # Delete the user and pending registration
        user.delete()
        
        return Response({
            'message': f'Registration for {pending_reg.user.email} rejected and deleted'
        }, status=status.HTTP_200_OK)

class EmailAccessViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing email access and class assignments
    """
    queryset = EmailAccess.objects.all()
    serializer_class = EmailAccessSerializer
    permission_classes = [permissions.IsAdminUser]
    
    def get_queryset(self):
        queryset = super().get_queryset()
        assigned_class = self.request.query_params.get('assigned_class')
        is_active = self.request.query_params.get('is_active')
        
        if assigned_class:
            queryset = queryset.filter(assigned_class_id=assigned_class)
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')
        
        return queryset
