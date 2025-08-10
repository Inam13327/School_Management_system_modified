from django.contrib import admin
from django.contrib.auth.models import User
from .models import Class, Student, Attendance, Subject, Marks, Fee, ChangeRequest, ChangeRequestItem, MonthlyTest, TestMarks, UserProfile, PendingRegistration, EmailAccess
from django.contrib.admin import DateFieldListFilter
from django.utils.translation import gettext_lazy as _
from django.utils.html import format_html
from django.utils.safestring import mark_safe
from django import forms
from django.shortcuts import render, redirect
from django.urls import path
from django.http import HttpResponseRedirect
from django.utils import timezone
from django.contrib import messages
from django.contrib.admin.sites import AdminSite
from .utils import create_change_request, get_object_data, deep_delete_by_email
from django.db import models
from django.db import IntegrityError

class CustomAdminSite(AdminSite):
    index_template = 'admin/index.html'
    
    def index(self, request, extra_context=None):
        extra_context = extra_context or {}
        pending_count = ChangeRequest.objects.filter(status='pending').count()
        recent_count = ChangeRequest.objects.filter(requested_at__gte=timezone.now() - timezone.timedelta(days=7)).count()
        approved_count = ChangeRequest.objects.filter(status='approved', requested_at__gte=timezone.now() - timezone.timedelta(days=7)).count()
        rejected_count = ChangeRequest.objects.filter(status='rejected', requested_at__gte=timezone.now() - timezone.timedelta(days=7)).count()
        
        extra_context.update({
            'pending_count': pending_count,
            'recent_count': recent_count,
            'approved_count': approved_count,
            'rejected_count': rejected_count,
        })
        return super().index(request, extra_context)

# Create custom admin site instance
admin_site = CustomAdminSite(name='custom_admin')

class ClassAdmin(admin.ModelAdmin):
    list_display = ('id', 'name')

class StudentAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'serial_no', 'name', 'date_of_admission', 'dob', 'dob_words', 'father_name',
        'tribe_or_caste', 'occupation', 'residence', 'class_admitted', 'age_at_admission',
        'class_withdrawn', 'date_of_withdrawal', 'remarks', 'pic', 'gender', 'batch_no', 'is_archived'
    )
    list_filter = ('class_admitted', 'batch_no', 'is_archived')
    search_fields = ('name', 'serial_no', 'father_name', 'tribe_or_caste', 'residence', 'remarks', 'batch_no')
    fields = (
        'serial_no', 'name', 'date_of_admission', 'dob', 'dob_words', 'father_name',
        'tribe_or_caste', 'occupation', 'residence', 'class_admitted', 'age_at_admission',
        'class_withdrawn', 'date_of_withdrawal', 'remarks', 'pic', 'gender', 'batch_no', 'is_archived'
    )

    def save_model(self, request, obj, form, change):
        """Track changes when saving students through admin"""
        if change:  # Only track changes, not new records
            # Get the old object before saving
            old_obj = Student.objects.get(pk=obj.pk)
            old_data = {
                'name': old_obj.name,
                'father_name': old_obj.father_name,
                'serial_no': old_obj.serial_no,
                'date_of_admission': old_obj.date_of_admission,
                'dob': old_obj.dob,
                'dob_words': old_obj.dob_words,
                'tribe_or_caste': old_obj.tribe_or_caste,
                'occupation': old_obj.occupation,
                'residence': old_obj.residence,
                'class_admitted': old_obj.class_admitted,
                'age_at_admission': old_obj.age_at_admission,
                'class_withdrawn': old_obj.class_withdrawn,
                'date_of_withdrawal': old_obj.date_of_withdrawal,
                'remarks': old_obj.remarks,
                'gender': old_obj.gender,
                'batch_no': old_obj.batch_no,
                'is_archived': old_obj.is_archived
            }
            new_data = {
                'name': obj.name,
                'father_name': obj.father_name,
                'serial_no': obj.serial_no,
                'date_of_admission': obj.date_of_admission,
                'dob': obj.dob,
                'dob_words': obj.dob_words,
                'tribe_or_caste': obj.tribe_or_caste,
                'occupation': obj.occupation,
                'residence': obj.residence,
                'class_admitted': obj.class_admitted,
                'age_at_admission': obj.age_at_admission,
                'class_withdrawn': obj.class_withdrawn,
                'date_of_withdrawal': obj.date_of_withdrawal,
                'remarks': obj.remarks,
                'gender': obj.gender,
                'batch_no': obj.batch_no,
                'is_archived': obj.is_archived
            }
            create_change_request('student', obj.id, old_data, new_data, request.user)
        super().save_model(request, obj, form, change)

class MonthListFilter(admin.SimpleListFilter):
    title = _('month')
    parameter_name = 'month_only'

    def lookups(self, request, model_admin):
        months = [
            ('01', _('January')),
            ('02', _('February')),
            ('03', _('March')),
            ('04', _('April')),
            ('05', _('May')),
            ('06', _('June')),
            ('07', _('July')),
            ('08', _('August')),
            ('09', _('September')),
            ('10', _('October')),
            ('11', _('November')),
            ('12', _('December')),
        ]
        return months

    def queryset(self, request, queryset):
        value = self.value()
        if value:
            return queryset.filter(date__month=value)
        return queryset

class ChangeRequestMonthFilter(admin.SimpleListFilter):
    title = _('Request Month')
    parameter_name = 'request_month'

    def lookups(self, request, model_admin):
        # Get unique months from existing change requests
        from django.db.models import Q
        months = ChangeRequest.objects.dates('requested_at', 'month', order='DESC')
        month_choices = []
        for month in months:
            month_key = month.strftime('%Y-%m')
            month_label = month.strftime('%B %Y')
            month_choices.append((month_key, month_label))
        return month_choices

    def queryset(self, request, queryset):
        value = self.value()
        if value:
            try:
                year, month = value.split('-')
                return queryset.filter(
                    requested_at__year=year,
                    requested_at__month=month
                )
            except ValueError:
                return queryset
        return queryset

class AttendanceUploadForm(forms.Form):
    class_admitted = forms.CharField(max_length=50, label='Class Admitted')
    date = forms.DateField(label='Date')
    present = forms.BooleanField(label='Mark all as present?', required=False, initial=True)

class AttendanceAdmin(admin.ModelAdmin):
    list_display = ('id', 'student', 'date', 'present')
    list_filter = ('date', 'present')
    search_fields = ('student__name',)
    change_list_template = "admin/attendance_changelist.html"

    def save_model(self, request, obj, form, change):
        if change:
            old_obj = Attendance.objects.get(pk=obj.pk)
            old_data = {'present': old_obj.present}
            new_data = {'present': obj.present}
            create_change_request('attendance', obj.id, old_data, new_data, request.user)
        super().save_model(request, obj, form, change)

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path('upload-class-attendance/', self.admin_site.admin_view(self.upload_class_attendance), name='upload-class-attendance'),
        ]
        return custom_urls + urls

    def upload_class_attendance(self, request):
        if request.method == 'POST':
            form = AttendanceUploadForm(request.POST)
            if form.is_valid():
                class_admitted = form.cleaned_data['class_admitted']
                date = form.cleaned_data['date']
                present = form.cleaned_data['present']
                students = Student.objects.filter(class_admitted=class_admitted)
                for student in students:
                    # Check if attendance record exists
                    try:
                        existing_attendance = Attendance.objects.get(student=student, date=date)
                        old_present = existing_attendance.present
                        # Update the record
                        existing_attendance.present = present
                        existing_attendance.save()
                        # Track changes if the value actually changed
                        if old_present != present:
                            old_data = {'present': old_present}
                            new_data = {'present': present}
                            create_change_request('attendance', existing_attendance.id, old_data, new_data, request.user)
                    except Attendance.DoesNotExist:
                        # Create new record
                        Attendance.objects.create(student=student, date=date, present=present)
                self.message_user(request, f"Attendance uploaded for {class_admitted} on {date}.")
                return HttpResponseRedirect("../")
        else:
            form = AttendanceUploadForm()
        context = dict(
            self.admin_site.each_context(request),
            form=form,
        )
        return render(request, "admin/upload_class_attendance.html", context)



class MarksAdmin(admin.ModelAdmin):
    list_display = ('student', 'get_class_admitted','subject', 'get_total_marks', 'get_obtained_marks', 'get_percentage', 'get_batch_no')
    list_filter = ['student__batch_no', 'student__class_admitted','subject__name']  # related fields via student
    search_fields = ('student__name',)

    def get_total_marks(self, obj):
        return 100
    get_total_marks.short_description = 'Total Marks'

    def get_obtained_marks(self, obj):
        return obj.marks or 0
    get_obtained_marks.short_description = 'Obtained Marks'

    def get_percentage(self, obj):
        total = self.get_total_marks(obj)
        obtained = self.get_obtained_marks(obj)
        if total > 0:
            return f"{(obtained / total) * 100:.2f}%"
        return "0.00%"
    get_percentage.short_description = 'Percentage'

    def get_batch_no(self, obj):
        return getattr(obj.student, 'batch_no', 'N/A')
    get_batch_no.short_description = 'Batch No'

    def get_class_admitted(self, obj):
        return getattr(obj.student, 'class_admitted', 'N/A')  # update according to your actual model
    get_class_admitted.short_description = 'Class Admitted'

    def save_model(self, request, obj, form, change):
        if change:
            old_obj = Marks.objects.get(pk=obj.pk)
            old_data = {'marks': old_obj.marks}
            new_data = {'marks': obj.marks}
            create_change_request('marks', obj.id, old_data, new_data, request.user)
        super().save_model(request, obj, form, change)




class FeeAdmin(admin.ModelAdmin):
    list_display = ('student', 'month', 'total_fee', 'submitted_fee', 'fine', 'absentees', 'created_at', 'updated_at')
    search_fields = ('student__name', 'month')
    list_filter = ('month',)

    def save_model(self, request, obj, form, change):
        if change:
            old_obj = Fee.objects.get(pk=obj.pk)
            old_data = {
                'total_fee': old_obj.total_fee,
                'submitted_fee': old_obj.submitted_fee,
                'fine': old_obj.fine,
                'absentees': old_obj.absentees
            }
            new_data = {
                'total_fee': obj.total_fee,
                'submitted_fee': obj.submitted_fee,
                'fine': obj.fine,
                'absentees': obj.absentees
            }
            create_change_request('fee', obj.id, old_data, new_data, request.user)
        super().save_model(request, obj, form, change)

class SubjectAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'class_fk', 'created_at')
    search_fields = ('name', 'class_fk__name')
    list_filter = ('class_fk',)

class ChangeRequestForm(forms.ModelForm):
    class Meta:
        model = ChangeRequest
        fields = '__all__'
    
    def clean(self):
        cleaned_data = super().clean()
        model_type = cleaned_data.get('model_type')
        object_id = cleaned_data.get('object_id')
        
        # If this is a new change request (not created programmatically)
        if not self.instance.pk:
            if not model_type:
                raise forms.ValidationError("Model type is required.")
            if not object_id:
                raise forms.ValidationError("Object ID is required when creating change requests manually.")
        
        return cleaned_data

class ChangeRequestItemInline(admin.TabularInline):
    model = ChangeRequestItem
    extra = 0
    readonly_fields = ('field_name', 'old_value', 'new_value')
    can_delete = False

class ChangeRequestAdmin(admin.ModelAdmin):
    form = ChangeRequestForm
    list_display = ('id', 'model_type_display', 'object_id_display', 'change_details', 'marks_changes', 'requested_changes_data', 'status_display', 'requested_by_username', 'requested_at', 'reviewed_by_username', 'reviewed_at')
    list_filter = ('status', 'model_type', ChangeRequestMonthFilter)
    search_fields = ('object_id', 'requested_by__username', 'reviewed_by__username')
    readonly_fields = ('requested_by', 'requested_at')
    inlines = [ChangeRequestItemInline]
    actions = ['approve_changes', 'reject_changes']
    change_list_template = "admin/change_request_changelist.html"
    
    def model_type_display(self, obj):
        return obj.get_model_type_display()
    model_type_display.short_description = 'Model Type'
    
    def object_id_display(self, obj):
        if obj.object_id is None:
            return "N/A"
        
        try:
            if obj.model_type == 'student':
                object_id = int(obj.object_id)
                student = Student.objects.get(id=object_id)
                return f"{student.name} (ID: {obj.object_id})"
            elif obj.model_type == 'attendance':
                object_id = int(obj.object_id)
                attendance = Attendance.objects.get(id=object_id)
                return f"{attendance.student.name} - {attendance.date} (ID: {obj.object_id})"
            elif obj.model_type == 'marks':
                object_id = int(obj.object_id)
                marks = Marks.objects.get(id=object_id)
                return f"{marks.student.name} - {marks.subject.name} (ID: {obj.object_id})"
            elif obj.model_type == 'fee':
                object_id = int(obj.object_id)
                fee = Fee.objects.get(id=object_id)
                return f"{fee.student.name} - {fee.month.strftime('%Y-%m')} (ID: {obj.object_id})"
            elif obj.model_type == 'monthly_test':
                object_id = int(obj.object_id)
                test = MonthlyTest.objects.get(id=object_id)
                return f"{test.title} - {test.subject} (ID: {obj.object_id})"
            elif obj.model_type == 'test_marks':
                try:
                    # First try to convert object_id to integer for lookup
                    try:
                        object_id = int(obj.object_id)
                        test_marks = TestMarks.objects.get(id=object_id)
                    except (ValueError, TestMarks.DoesNotExist):
                        # If that fails, check if object_id is in format "test_id_student_id"
                        if '_' in obj.object_id:
                            parts = obj.object_id.split('_')
                            if len(parts) == 2:
                                test_id, student_id = parts
                                test_marks = TestMarks.objects.get(test_id=test_id, student_id=student_id)
                            else:
                                return f"Test Marks (ID: {obj.object_id})"
                        else:
                            return f"Test Marks (ID: {obj.object_id})"
                    
                    return f"{test_marks.student.name} - {test_marks.test.title} (ID: {obj.object_id})"
                except Exception:
                    return f"Test Marks (ID: {obj.object_id})"
            else:
                return f"ID: {obj.object_id}"
        except (Student.DoesNotExist, Attendance.DoesNotExist, Marks.DoesNotExist, Fee.DoesNotExist, MonthlyTest.DoesNotExist, TestMarks.DoesNotExist, ValueError):
            return f"ID: {obj.object_id} (Not Found)"
    object_id_display.short_description = 'Student/Record'
    
    def change_details(self, obj):
        """Show detailed information about what's being changed"""
        if obj.model_type == 'marks':
            try:
                marks = Marks.objects.get(id=obj.object_id)
                items = obj.items.all()
                if items.exists():
                    item = items.first()  # Get the first change item
                    return f"Update {marks.subject.name} marks for {marks.student.name}: {item.old_value} → {item.new_value}"
                else:
                    return f"Update {marks.subject.name} marks for {marks.student.name}"
            except Marks.DoesNotExist:
                return f"Marks record (ID: {obj.object_id})"
        elif obj.model_type == 'attendance':
            try:
                attendance = Attendance.objects.get(id=obj.object_id)
                items = obj.items.all()
                if items.exists():
                    item = items.first()
                    old_status = "Present" if item.old_value.lower() == 'true' else "Absent"
                    new_status = "Present" if item.new_value.lower() == 'true' else "Absent"
                    return f"Update {attendance.student.name} attendance on {attendance.date}: {old_status} → {new_status}"
                else:
                    return f"Update {attendance.student.name} attendance on {attendance.date}"
            except Attendance.DoesNotExist:
                return f"Attendance record (ID: {obj.object_id})"
        elif obj.model_type == 'student':
            try:
                student = Student.objects.get(id=obj.object_id)
                items = obj.items.all()
                changes = []
                for item in items:
                    changes.append(f"{item.field_name}: {item.old_value} → {item.new_value}")
                if changes:
                    return f"Update {student.name}: {', '.join(changes)}"
                else:
                    return f"Update {student.name}"
            except Student.DoesNotExist:
                return f"Student record (ID: {obj.object_id})"
        elif obj.model_type == 'fee':
            try:
                fee = Fee.objects.get(id=obj.object_id)
                items = obj.items.all()
                changes = []
                for item in items:
                    changes.append(f"{item.field_name}: {item.old_value} → {item.new_value}")
                if changes:
                    return f"Update {fee.student.name} fee for {fee.month.strftime('%Y-%m')}: {', '.join(changes)}"
                else:
                    return f"Update {fee.student.name} fee for {fee.month.strftime('%Y-%m')}"
            except Fee.DoesNotExist:
                return f"Fee record (ID: {obj.object_id})"
        elif obj.model_type == 'monthly_test':
            try:
                test = MonthlyTest.objects.get(id=obj.object_id)
                items = obj.items.all()
                changes = []
                for item in items:
                    changes.append(f"{item.field_name}: {item.old_value} → {item.new_value}")
                if changes:
                    return f"Update {test.title} ({test.subject}): {', '.join(changes)}"
                else:
                    return f"Update {test.title} ({test.subject})"
            except MonthlyTest.DoesNotExist:
                return f"Monthly Test record (ID: {obj.object_id})"
        elif obj.model_type == 'test_marks':
            try:
                # First try to convert object_id to integer for lookup
                try:
                    object_id_int = int(obj.object_id)
                    test_marks = TestMarks.objects.get(id=object_id_int)
                except (ValueError, TestMarks.DoesNotExist):
                    # If that fails, check if object_id is in format "test_id_student_id"
                    if '_' in obj.object_id:
                        parts = obj.object_id.split('_')
                        if len(parts) == 2:
                            test_id, student_id = parts
                            test_marks = TestMarks.objects.get(test_id=test_id, student_id=student_id)
                        else:
                            raise ValueError(f"Invalid object_id format: {obj.object_id}")
                    else:
                        raise ValueError(f"Invalid object_id format: {obj.object_id}")
                
                items = obj.items.all()
                print(f"Test Marks change request - Object ID: {obj.object_id}")
                print(f"Test Marks object: {test_marks.student.name} - {test_marks.test.title}")
                print(f"Number of change items: {items.count()}")
                
                changes = []
                for item in items:
                    print(f"Change item: {item.field_name} = {item.old_value} → {item.new_value}")
                    changes.append(f"{item.field_name}: {item.old_value} → {item.new_value}")
                
                if changes:
                    return f"Update {test_marks.student.name} marks for {test_marks.test.title}: {', '.join(changes)}"
                else:
                    print("No changes found in test_marks change request")
                    return f"Update {test_marks.student.name} marks for {test_marks.test.title} (No changes found)"
            except Exception as e:
                print(f"Error in test_marks change_details: {str(e)}")
                return f"Test Marks record (ID: {obj.object_id}) - Error: {str(e)}"
        else:
            return "Change details not available"
    change_details.short_description = 'Change Details'
    
    def marks_changes(self, obj):
        """Show all changes for this change request with debugging info"""
        items = obj.items.all()
        print(f"Marks changes for change request {obj.id} (model_type: {obj.model_type})")
        print(f"Number of items: {items.count()}")
        
        if not items.exists():
            print("No items found in change request")
            return "No changes found"
        
        changes = []
        for item in items:
            print(f"Item: {item.field_name} = {item.old_value} → {item.new_value}")
            changes.append(f"{item.field_name}: {item.old_value} → {item.new_value}")
        
        if changes:
            result = f"Changes: {', '.join(changes)}"
            print(f"Returning: {result}")
            return result
        else:
            print("No changes found in items")
            return "No changes found"
    marks_changes.short_description = 'All Changes'
    
    def requested_changes_data(self, obj):
        """Show the old and new data that was requested for approval"""
        items = obj.items.all()
        
        if not items.exists():
            return "No changes requested"
        
        changes_data = []
        for item in items:
            if item.old_value != item.new_value:
                changes_data.append(f"{item.field_name}: {item.old_value} → {item.new_value}")
            else:
                changes_data.append(f"{item.field_name}: {item.old_value} (no change)")
        
        if changes_data:
            return format_html('<br>'.join(changes_data))
        else:
            return "No actual changes detected"
    
    requested_changes_data.short_description = 'Requested Changes'
    
    def status_display(self, obj):
        status_colors = {
            'pending': 'orange',
            'approved': 'green',
            'rejected': 'red'
        }
        color = status_colors.get(obj.status, 'black')
        return format_html('<span style="color: {}; font-weight: bold;">{}</span>', color, obj.get_status_display())
    status_display.short_description = 'Status'
    
    def requested_by_username(self, obj):
        if obj.requested_by:
            return obj.requested_by.username
        elif obj.requested_by is None:
            # Try to get class name from the object being changed
            try:
                if obj.model_type == 'student' and obj.object_id:
                    object_id = int(obj.object_id)
                    student = Student.objects.get(id=object_id)
                    return f"Class {student.class_admitted or 'Unknown'}"
                elif obj.model_type == 'attendance' and obj.object_id:
                    object_id = int(obj.object_id)
                    attendance = Attendance.objects.get(id=object_id)
                    return f"Class {attendance.student.class_admitted or 'Unknown'}"
                elif obj.model_type == 'marks' and obj.object_id:
                    object_id = int(obj.object_id)
                    marks = Marks.objects.get(id=object_id)
                    return f"Class {marks.student.class_admitted or 'Unknown'}"
                elif obj.model_type == 'fee' and obj.object_id:
                    object_id = int(obj.object_id)
                    fee = Fee.objects.get(id=object_id)
                    return f"Class {fee.student.class_admitted or 'Unknown'}"
                elif obj.model_type == 'monthly_test' and obj.object_id:
                    object_id = int(obj.object_id)
                    test = MonthlyTest.objects.get(id=object_id)
                    return f"Class {test.class_fk.name or 'Unknown'}"
                elif obj.model_type == 'test_marks' and obj.object_id:
                    try:
                        # First try to convert object_id to integer for lookup
                        try:
                            object_id = int(obj.object_id)
                            test_marks = TestMarks.objects.get(id=object_id)
                        except (ValueError, TestMarks.DoesNotExist):
                            # If that fails, check if object_id is in format "test_id_student_id"
                            if '_' in obj.object_id:
                                parts = obj.object_id.split('_')
                                if len(parts) == 2:
                                    test_id, student_id = parts
                                    test_marks = TestMarks.objects.get(test_id=test_id, student_id=student_id)
                                else:
                                    return 'Frontend User'
                            else:
                                return 'Frontend User'
                        
                        return f"Class {test_marks.student.class_admitted or 'Unknown'}"
                    except Exception:
                        return 'Frontend User'
                else:
                    return 'Frontend User'
            except (Student.DoesNotExist, Attendance.DoesNotExist, Marks.DoesNotExist, Fee.DoesNotExist, MonthlyTest.DoesNotExist, TestMarks.DoesNotExist, ValueError):
                return 'Frontend User'
        else:
            return 'System'
    requested_by_username.short_description = 'Requested By'
    
    def reviewed_by_username(self, obj):
        return obj.reviewed_by.username if obj.reviewed_by else '-'
    reviewed_by_username.short_description = 'Reviewed By'
    
    def approve_changes(self, request, queryset):
        approved_count = 0
        for change_request in queryset.filter(status='pending'):
            try:
                # Check if object_id is available for applying changes
                if not change_request.object_id:
                    messages.error(request, f"Change request {change_request.id} cannot be approved: Object ID is missing.")
                    continue
                
                # Apply the changes based on model type
                if change_request.model_type == 'marks':
                    self._apply_marks_changes(change_request)
                elif change_request.model_type == 'attendance':
                    self._apply_attendance_changes(change_request)
                elif change_request.model_type == 'student':
                    self._apply_student_changes(change_request)
                elif change_request.model_type == 'fee':
                    self._apply_fee_changes(change_request)
                elif change_request.model_type == 'monthly_test':
                    self._apply_monthly_test_changes(change_request)
                elif change_request.model_type == 'test_marks':
                    print(f"Applying test_marks changes for object_id: {change_request.object_id}")
                    self._apply_test_marks_changes(change_request)
                    print(f"Successfully applied test_marks changes for object_id: {change_request.object_id}")
                
                # Update change request status
                change_request.status = 'approved'
                change_request.reviewed_by = request.user
                change_request.reviewed_at = timezone.now()
                change_request.save()
                approved_count += 1
                
            except Exception as e:
                messages.error(request, f"Error approving change request {change_request.id}: {str(e)}")
        
        if approved_count > 0:
            messages.success(request, f"Successfully approved {approved_count} change request(s).")
        else:
            messages.warning(request, "No pending change requests were approved.")
    
    approve_changes.short_description = "Approve selected change requests"
    
    def reject_changes(self, request, queryset):
        rejected_count = 0
        for change_request in queryset.filter(status='pending'):
            change_request.status = 'rejected'
            change_request.reviewed_by = request.user
            change_request.reviewed_at = timezone.now()
            change_request.save()
            rejected_count += 1
        
        if rejected_count > 0:
            messages.success(request, f"Successfully rejected {rejected_count} change request(s).")
        else:
            messages.warning(request, "No pending change requests were rejected.")
    
    reject_changes.short_description = "Reject selected change requests"
    
    def _apply_marks_changes(self, change_request):
        """Apply changes to Marks model"""
        if not change_request.object_id:
            raise Exception("Object ID is required to apply changes")
        try:
            # Convert object_id to int for Marks model
            object_id = int(change_request.object_id)
            marks_obj = Marks.objects.get(id=object_id)
            for item in change_request.items.all():
                if item.field_name == 'marks':
                    marks_obj.marks = float(item.new_value) if item.new_value else None
                    marks_obj.save()
        except (Marks.DoesNotExist, ValueError):
            raise Exception(f"Marks object with id {change_request.object_id} not found")
    
    def _apply_attendance_changes(self, change_request):
        """Apply changes to Attendance model"""
        if not change_request.object_id:
            raise Exception("Object ID is required to apply changes")
        try:
            # Convert object_id to int for Attendance model
            object_id = int(change_request.object_id)
            attendance_obj = Attendance.objects.get(id=object_id)
            for item in change_request.items.all():
                if item.field_name == 'present':
                    attendance_obj.present = item.new_value.lower() == 'true'
                    attendance_obj.save()
        except (Attendance.DoesNotExist, ValueError):
            raise Exception(f"Attendance object with id {change_request.object_id} not found")
    
    def _apply_student_changes(self, change_request):
        """Apply changes to Student model"""
        if not change_request.object_id:
            raise Exception("Object ID is required to apply changes")
        try:
            # Convert object_id to int for Student model
            object_id = int(change_request.object_id)
            student_obj = Student.objects.get(id=object_id)
            for item in change_request.items.all():
                if hasattr(student_obj, item.field_name):
                    setattr(student_obj, item.field_name, item.new_value)
                    student_obj.save()
        except (Student.DoesNotExist, ValueError):
            raise Exception(f"Student object with id {change_request.object_id} not found")
    
    def _apply_fee_changes(self, change_request):
        """Apply changes to Fee model"""
        if not change_request.object_id:
            raise Exception("Object ID is required to apply changes")
        try:
            # Convert object_id to int for Fee model
            object_id = int(change_request.object_id)
            fee_obj = Fee.objects.get(id=object_id)
            for item in change_request.items.all():
                if hasattr(fee_obj, item.field_name):
                    if item.field_name in ['total_fee', 'submitted_fee', 'fine']:
                        setattr(fee_obj, item.field_name, float(item.new_value) if item.new_value else 0)
                    elif item.field_name == 'absentees':
                        setattr(fee_obj, item.field_name, int(item.new_value) if item.new_value else 0)
                    else:
                        setattr(fee_obj, item.field_name, item.new_value)
                    fee_obj.save()
        except (Fee.DoesNotExist, ValueError):
            raise Exception(f"Fee object with id {change_request.object_id} not found")

    def _apply_monthly_test_changes(self, change_request):
        """Apply changes to MonthlyTest model"""
        if not change_request.object_id:
            raise Exception("Object ID is required to apply changes")
        try:
            # Convert object_id to int for MonthlyTest model
            object_id = int(change_request.object_id)
            test_obj = MonthlyTest.objects.get(id=object_id)
            
            # Track if total_marks changed
            total_marks_changed = False
            new_total_marks = None
            
            for item in change_request.items.all():
                if hasattr(test_obj, item.field_name):
                    if item.field_name == 'total_marks':
                        new_total_marks = int(item.new_value) if item.new_value else 0
                        setattr(test_obj, item.field_name, new_total_marks)
                        total_marks_changed = True
                    else:
                        setattr(test_obj, item.field_name, item.new_value)
                    test_obj.save()
            
            # If total_marks changed, update all related TestMarks records
            if total_marks_changed and new_total_marks is not None:
                print(f"Updating TestMarks total_marks to {new_total_marks} for test {test_obj.id}")
                TestMarks.objects.filter(test=test_obj).update(total_marks=new_total_marks)
                print(f"Updated {TestMarks.objects.filter(test=test_obj).count()} TestMarks records")
                
        except (MonthlyTest.DoesNotExist, ValueError):
            raise Exception(f"MonthlyTest object with id {change_request.object_id} not found")

    def _apply_test_marks_changes(self, change_request):
        """Apply changes to TestMarks model"""
        from .models import TestMarks
        if not change_request.object_id:
            raise Exception("Object ID is required to apply changes")
        try:
            # Parse object_id as string (should be testmarks id)
            object_id = str(change_request.object_id)
            print(f"[DEBUG] Applying test_marks changes for object_id: {object_id}")
            test_marks_obj = TestMarks.objects.get(id=object_id)
            changes_made = False
            for item in change_request.items.all():
                print(f"[DEBUG] Field: {item.field_name}, Old: {item.old_value}, New: {item.new_value}")
                if hasattr(test_marks_obj, item.field_name):
                    if item.field_name == 'marks':
                        print(f"[DEBUG] Updating marks from {test_marks_obj.marks} to {item.new_value}")
                        setattr(test_marks_obj, item.field_name, float(item.new_value) if item.new_value else 0)
                        changes_made = True
            if changes_made:
                test_marks_obj.save()
                print(f"[DEBUG] TestMarks saved successfully. New marks: {test_marks_obj.marks}")
                test_marks_obj.refresh_from_db()
                print(f"[DEBUG] After refresh - marks: {test_marks_obj.marks}")
            else:
                print("[DEBUG] No changes were made to TestMarks object")
        except TestMarks.DoesNotExist:
            raise Exception(f"TestMarks object with id {change_request.object_id} not found")
        except Exception as e:
            print(f"[DEBUG] Error in _apply_test_marks_changes: {str(e)}")
            raise Exception(f"Failed to apply test marks changes: {str(e)}")
    
    def get_queryset(self, request):
        """Show pending changes first"""
        qs = super().get_queryset(request)
        return qs.extra(
            select={'status_order': "CASE WHEN status = 'pending' THEN 0 WHEN status = 'approved' THEN 1 ELSE 2 END"}
        ).order_by('status_order', '-requested_at')
    
    def changelist_view(self, request, extra_context=None):
        """Add recent changes count to the admin"""
        extra_context = extra_context or {}
        pending_count = ChangeRequest.objects.filter(status='pending').count()
        recent_count = ChangeRequest.objects.filter(requested_at__gte=timezone.now() - timezone.timedelta(days=7)).count()
        approved_count = ChangeRequest.objects.filter(status='approved', requested_at__gte=timezone.now() - timezone.timedelta(days=7)).count()
        rejected_count = ChangeRequest.objects.filter(status='rejected', requested_at__gte=timezone.now() - timezone.timedelta(days=7)).count()
        
        extra_context.update({
            'pending_count': pending_count,
            'recent_count': recent_count,
            'approved_count': approved_count,
            'rejected_count': rejected_count,
        })
        return super().changelist_view(request, extra_context)

class ChangeRequestItemForm(forms.ModelForm):
    class Meta:
        model = ChangeRequestItem
        fields = '__all__'
    
    def clean(self):
        cleaned_data = super().clean()
        change_request = cleaned_data.get('change_request')
        
        if not change_request:
            raise forms.ValidationError("Change request is required.")
        
        return cleaned_data

class ChangeRequestItemAdmin(admin.ModelAdmin):
    form = ChangeRequestItemForm
    list_display = ('change_request', 'field_name', 'old_value', 'new_value')
    list_filter = ('field_name',)
    search_fields = ('field_name', 'old_value', 'new_value')
    readonly_fields = ('field_name', 'old_value', 'new_value')

class TestMarksInline(admin.TabularInline):
    model = TestMarks
    extra = 0
    fields = ('student', 'total_marks', 'marks')
    readonly_fields = ('total_marks',)

class MonthNameListFilter(admin.SimpleListFilter):
    title = _('Month')
    parameter_name = 'month_name'

    def lookups(self, request, model_admin):
        months = [
            ('01', _('January')),
            ('02', _('February')),
            ('03', _('March')),
            ('04', _('April')),
            ('05', _('May')),
            ('06', _('June')),
            ('07', _('July')),
            ('08', _('August')),
            ('09', _('September')),
            ('10', _('October')),
            ('11', _('November')),
            ('12', _('December')),
        ]
        return months

    def queryset(self, request, queryset):
        value = self.value()
        if value:
            return queryset.filter(month__month=value)
        return queryset

class MonthlyTestAdmin(admin.ModelAdmin):
    list_display = ('title', 'subject', 'class_fk', 'total_marks', 'obtained_marks', 'student_marks_table', 'percentage', 'students_count', 'month', 'created_at')
    list_filter = ('subject', 'class_fk', MonthNameListFilter, 'created_at')
    search_fields = ('title', 'subject', 'description')
    readonly_fields = ('created_at', 'updated_at')
    inlines = [TestMarksInline]
    ordering = ('-created_at',)
    list_per_page = 25
    actions = ['refresh_test_data']
    
    def refresh_test_data(self, request, queryset):
        """Refresh test data to ensure latest marks are displayed"""
        for test in queryset:
            # Force refresh from database
            test.refresh_from_db()
            # Refresh related test marks
            for mark in test.test_marks.all():
                mark.refresh_from_db()
        self.message_user(request, f"Refreshed data for {queryset.count()} test(s)")
    refresh_test_data.short_description = "Refresh test data"
    
    def get_queryset(self, request):
        """Force fresh queryset to avoid caching issues"""
        qs = super().get_queryset(request)
        # Force evaluation to ensure fresh data
        qs = qs.select_related('class_fk').prefetch_related('test_marks')
        # Add cache busting parameter
        if request.GET.get('refresh'):
            # Force refresh all related objects
            for test in qs:
                test.refresh_from_db()
                for mark in test.test_marks.all():
                    mark.refresh_from_db()
        return qs
    
    def obtained_marks(self, obj):
        """Calculate total obtained marks for this test"""
        # Force a fresh query to get the latest data
        test_marks = obj.test_marks.all()
        total_obtained = sum(mark.marks for mark in test_marks)
        print(f"Test {obj.title} - Total obtained marks: {total_obtained}")
        return total_obtained
    obtained_marks.short_description = 'Obtained Marks'
    
    def students_count(self, obj):
        """Show number of students who took this test"""
        count = obj.test_marks.count()
        return count
    students_count.short_description = 'Students'
    
    def percentage(self, obj):
        """Calculate overall percentage for this test"""
        total_obtained = obj.test_marks.aggregate(
            total=models.Sum('marks')
        )['total'] or 0
        total_possible = obj.test_marks.aggregate(
            total=models.Sum('total_marks')
        )['total'] or 0
        
        if total_obtained is None:
            total_obtained = 0
        if total_possible is None:
            total_possible = 0
        
        if total_possible > 0:
            percentage = (total_obtained / total_possible) * 100
            return f"{percentage:.1f}%"
        return "0%"
    percentage.short_description = 'Overall %'
    
    def student_marks_table(self, obj):
        """Display a table of all students and their obtained marks for this test."""
        # Force complete refresh from database to get the latest marks
        obj.refresh_from_db()
        
        # Get fresh test marks data
        test_marks = obj.test_marks.select_related('student').all()
        
        print(f"Student Marks Table for Test: {obj.title}")
        print(f"Number of test marks found: {test_marks.count()}")
        
        rows = []
        for mark in test_marks:
            # Force refresh each mark to ensure latest data
            mark.refresh_from_db()
            
            # Check if marks were recently updated (within last 5 minutes)
            is_recently_updated = False
            if mark.updated_at:
                from django.utils import timezone
                time_diff = timezone.now() - mark.updated_at
                is_recently_updated = time_diff.total_seconds() < 300  # 5 minutes
            
            print(f"Student: {mark.student.name}, Marks: {mark.marks}, Recently Updated: {is_recently_updated}")
            
            # Add visual indicator for recently updated marks
            row_style = "background-color: #e8f5e8;" if is_recently_updated else ""
            update_indicator = " 🔄" if is_recently_updated else ""
            
            rows.append(
                f"<tr style='{row_style}'><td>{mark.student.name}</td><td>{mark.marks}{update_indicator}</td></tr>"
            )
        
        if not rows:
            return "No students."
        
        table_html = """
        <table style='border-collapse:collapse;width:100%;'>
            <thead>
                <tr style='background-color:#f5f5f5;'>
                    <th style='border:1px solid #ccc;padding:4px 8px;text-align:left;'>Student Name</th>
                    <th style='border:1px solid #ccc;padding:4px 8px;text-align:center;'>Obtained Marks</th>
                </tr>
            </thead>
            <tbody>{}</tbody>
        </table>
        """.format(''.join(rows))
        return format_html(table_html)
    student_marks_table.short_description = 'Student Marks'
    student_marks_table.allow_tags = True
    
    fieldsets = (
        ('Test Information', {
            'fields': ('title', 'subject', 'class_fk', 'total_marks', 'month', 'description')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

class TestMarksAdmin(admin.ModelAdmin):
    list_display = ('student_name', 'test_title', 'total_marks', 'obtained_marks', 'percentage', 'created_at')
    list_filter = ('test__subject', 'test__class_fk', 'created_at')
    search_fields = ('test__title', 'student__name')
    readonly_fields = ('created_at', 'updated_at')
    ordering = ('student__name', '-created_at')
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('student', 'test')
    
    def student_name(self, obj):
        return obj.student.name
    student_name.short_description = 'Student Name'
    
    def test_title(self, obj):
        return obj.test.title
    test_title.short_description = 'Test Title'
    
    def obtained_marks(self, obj):
        return obj.marks
    obtained_marks.short_description = 'Obtained Marks'
    
    def percentage(self, obj):
        if obj.total_marks > 0:
            percentage = (obj.marks / obj.total_marks) * 100
            return f"{percentage:.1f}%"
        return "0%"
    percentage.short_description = 'Percentage'

# ============================================================================
# NEW ADMIN CLASSES FOR USER REGISTRATION AND AUTHENTICATION
# ============================================================================

class EmailAddressAdmin(admin.ModelAdmin):
    """
    Admin interface for managing email addresses and user accounts
    """
    list_display = ('user_email', 'user_username', 'user_full_name', 'user_role', 'class_name', 'registration_date', 'reset_password_button', 'delete_button')
    list_filter = ('registration_date',)
    search_fields = ('user__email', 'user__username', 'user__first_name', 'user__last_name')
    readonly_fields = ('user', 'registration_date')
    ordering = ('-registration_date',)
    actions = ['approve_selected', 'reject_selected']
    change_list_template = "admin/email_address_changelist.html"
    
    fieldsets = (
        ('User Information', {
            'fields': ('user', 'notes')
        }),
        ('Registration Details', {
            'fields': ('registration_date',),
            'classes': ('collapse',)
        })
    )
    
    def user_email(self, obj):
        return obj.user.email
    user_email.short_description = 'Email'
    
    def user_username(self, obj):
        return obj.user.username
    user_username.short_description = 'Username'
    
    def user_full_name(self, obj):
        return f"{obj.user.first_name} {obj.user.last_name}"
    user_full_name.short_description = 'Full Name'
    
    def user_role(self, obj):
        """Display the user's role from EmailAccess"""
        try:
            email_access = EmailAccess.objects.get(user=obj.user)
            role_display = {
                'teacher': 'Teacher',
                'staff': 'Staff', 
                'vice_principal': 'Vice Principal'
            }
            return role_display.get(email_access.role, email_access.role)
        except EmailAccess.DoesNotExist:
            return 'Not Assigned'
    user_role.short_description = 'Role'
    
    def class_name(self, obj):
        try:
            email_access = EmailAccess.objects.get(user=obj.user)
            if email_access.role == 'teacher' and email_access.assigned_class:
                return email_access.assigned_class.name
            return ''
        except EmailAccess.DoesNotExist:
            return ''
    class_name.short_description = 'Class Name'
    
    def reset_password_button(self, obj):
        return format_html(
            '<a class="button" href="{}" style="color: #2563eb; background: none; border: none;">Reset Password</a>',
            f'/admin/api/pendingregistration/{obj.id}/reset-password/'
        )
    reset_password_button.short_description = 'Reset Password'
    reset_password_button.allow_tags = True

    def delete_button(self, obj):
        from django.urls import reverse
        # Use the robust pattern for admin delete URL
        url_name = 'admin:%s_%s_delete' % (obj._meta.app_label, obj._meta.model_name)
        delete_url = reverse(url_name, args=[obj.pk])
        return format_html(
            '<a class="deletelink" href="{}" onclick="return confirm(\'Are you sure you want to delete this email and all related data?\');">Delete</a>',
            delete_url
        )
    delete_button.short_description = 'Delete'
    delete_button.allow_tags = True

    def get_urls(self):
        from django.urls import path
        urls = super().get_urls()
        custom_urls = [
            path('delete/<int:pk>/', self.admin_site.admin_view(self.delete_emailaddress), name='emailaddress_delete'),
            path('add-email/', self.admin_site.admin_view(self.add_email_account), name='add-email-account'),
        ]
        return custom_urls + urls

    def delete_emailaddress(self, request, pk):
        from django.shortcuts import redirect, get_object_or_404
        from django.contrib import messages
        obj = get_object_or_404(EmailAccess, pk=pk)
        email = obj.email
        if request.method == 'POST':
            deep_delete_by_email(email)
            messages.success(request, f'Email {email} and all related data deleted.')
            return redirect('..')
        messages.error(request, 'Invalid request.')
        return redirect('..')

    def approve_selected(self, request, queryset):
        """
        Approve selected pending registrations
        """
        approved_count = 0
        for pending_reg in queryset:
            if not pending_reg.user.is_active:
                user = pending_reg.user
                user.is_active = True
                user.save()
                
                user.profile.is_approved = True
                user.profile.assigned_class = pending_reg.requested_class
                user.profile.approved_by = request.user
                user.profile.approved_at = timezone.now()
                user.profile.save()
                
                EmailAccess.objects.create(
                    user=user,
                    email=user.email,
                    assigned_class=pending_reg.requested_class
                )
                
                pending_reg.delete()
                approved_count += 1
        
        self.message_user(request, f'Successfully approved {approved_count} registration(s)')
    approve_selected.short_description = "Approve selected registrations"
    
    def reject_selected(self, request, queryset):
        """
        Reject selected pending registrations
        """
        rejected_count = 0
        for pending_reg in queryset:
            if not pending_reg.user.is_active:
                user = pending_reg.user
                user.delete()
                rejected_count += 1
        
        self.message_user(request, f'Successfully rejected {rejected_count} registration(s)')
    reject_selected.short_description = "Reject selected registrations"
    
    def reset_password(self, request, pk):
        """
        Reset password for a specific pending registration
        """
        try:
            pending_reg = PendingRegistration.objects.get(pk=pk)
            user = pending_reg.user
            
            if request.method == 'POST':
                new_password = request.POST.get('new_password')
                if new_password:
                    user.set_password(new_password)
                    user.save()
                    messages.success(request, f'Password reset for {pending_reg.user.email}. New password: {new_password}')
                    return HttpResponseRedirect('../')
                else:
                    messages.error(request, 'New password is required.')
            
            # Show password reset form
            context = {
                'pending_reg': pending_reg,
                'title': 'Reset Password',
                'opts': PendingRegistration._meta,
                'app_label': 'api',
                'has_change_permission': True,
                'has_add_permission': True,
                'has_delete_permission': True,
                'has_view_permission': True,
            }
            return render(request, 'admin/reset_password_pending_form.html', context)
            
        except PendingRegistration.DoesNotExist:
            messages.error(request, 'Pending registration not found')
            return HttpResponseRedirect('../')
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('user', 'requested_class')

    def delete_model(self, request, obj):
        email = obj.user.email
        deep_delete_by_email(email)

    def changelist_view(self, request, extra_context=None):
        extra_context = extra_context or {}
        from django.urls import reverse
        extra_context['add_email_url'] = reverse('admin:add-email-account')
        return super().changelist_view(request, extra_context)

    def add_email_account(self, request):
        from .models import Class, EmailAccess
        from django.contrib.auth.models import User
        from django.db import IntegrityError
        from django.contrib import messages
        from django.urls import reverse
        if request.method == 'POST':
            email = request.POST.get('email')
            password = request.POST.get('password')
            first_name = request.POST.get('first_name')
            last_name = request.POST.get('last_name')
            role = request.POST.get('role')
            assigned_class_id = request.POST.get('assigned_class')
            try:
                if not (email and password and first_name and last_name and role):
                    messages.error(request, 'All fields are required.')
                    raise ValueError('Missing fields')
                user = User.objects.create_user(
                    username=email.split('@')[0],
                    email=email,
                    password=password,
                    first_name=first_name,
                    last_name=last_name,
                    is_active=True
                )
                email_access = EmailAccess.objects.create(
                    user=user,
                    email=email,
                    role=role
                )
                if role == 'teacher' and assigned_class_id:
                    email_access.assigned_class_id = assigned_class_id
                    email_access.save()
                messages.success(request, f'Email {email} created successfully.')
                changelist_url = reverse('admin:%s_%s_changelist' % (EmailAccess._meta.app_label, EmailAccess._meta.model_name))
                return redirect(changelist_url)
            except IntegrityError:
                messages.error(request, f'Email {email} already exists.')
            except Exception as e:
                messages.error(request, str(e))
        # Show form
        classes = Class.objects.all()
        return render(request, 'admin/add_email_form.html', {
            'classes': classes,
            'title': 'Add Email',
            'opts': self.model._meta,
            'app_label': self.model._meta.app_label,
        })

# Register all models with the custom admin site
admin_site.register(Class, ClassAdmin)
admin_site.register(Student, StudentAdmin)
admin_site.register(Attendance, AttendanceAdmin)
admin_site.register(Marks, MarksAdmin)
admin_site.register(Fee, FeeAdmin)
admin_site.register(Subject, SubjectAdmin)
admin_site.register(ChangeRequest, ChangeRequestAdmin)
admin_site.register(ChangeRequestItem, ChangeRequestItemAdmin)
admin_site.register(MonthlyTest, MonthlyTestAdmin)

admin_site.register(PendingRegistration, EmailAddressAdmin)

# admin_site.unregister(UserProfile)
    
    