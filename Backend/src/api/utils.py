from django.contrib.auth.models import User
from .models import ChangeRequest, ChangeRequestItem, EmailAccess, PendingRegistration
from django.utils import timezone
from django.contrib.auth import get_user_model

def create_change_request(model_type, object_id, old_data, new_data, user=None):
    """
    Create a change request for tracking data modifications
    
    Args:
        model_type: Type of model being changed ('marks', 'attendance', 'student', 'fee')
        object_id: ID of the object being changed
        old_data: Dictionary of old field values
        new_data: Dictionary of new field values
        user: User making the request (optional)
    """
    print(f"[DEBUG] create_change_request called for model_type={model_type}, object_id={object_id} (type: {type(object_id)})")
    print(f"[DEBUG] old_data: {old_data}")
    print(f"[DEBUG] new_data: {new_data}")
    
    # Check if there's already a pending change request for this object
    existing_request = ChangeRequest.objects.filter(
        model_type=model_type,
        object_id=object_id,
        status='pending'
    ).first()
    
    if existing_request:
        print(f"DEBUG: Found existing request ID: {existing_request.id}")
        # Update the existing change request with new data
        # Clear existing items and add new ones
        existing_request.items.all().delete()
        
        # Find which fields have changed
        changed_fields = []
        for field_name, new_value in new_data.items():
            if field_name in old_data and old_data[field_name] != new_value:
                changed_fields.append({
                    'field_name': field_name,
                    'old_value': str(old_data[field_name]) if old_data[field_name] is not None else '',
                    'new_value': str(new_value) if new_value is not None else ''
                })
        
        print(f"DEBUG: Changed fields: {changed_fields}")
        
        # Create change request items for each changed field
        for field_change in changed_fields:
            ChangeRequestItem.objects.create(
                change_request=existing_request,
                field_name=field_change['field_name'],
                old_value=field_change['old_value'],
                new_value=field_change['new_value']
            )
        
        return existing_request
    
    # Find which fields have changed
    changed_fields = []
    for field_name, new_value in new_data.items():
        if field_name in old_data and old_data[field_name] != new_value:
            changed_fields.append({
                'field_name': field_name,
                'old_value': str(old_data[field_name]) if old_data[field_name] is not None else '',
                'new_value': str(new_value) if new_value is not None else ''
            })
    
    print(f"[DEBUG] changed_fields: {changed_fields}")
    
    # Only create change request if there are actual changes
    if changed_fields:
        # Only set requested_by if user is authenticated and not anonymous
        requested_by = None
        if user and hasattr(user, 'is_authenticated') and user.is_authenticated and not user.is_anonymous:
            requested_by = user
        
        print(f"DEBUG: Creating new change request with requested_by: {requested_by}")
        
        change_request = ChangeRequest.objects.create(
            model_type=model_type,
            object_id=object_id,
            requested_by=requested_by,
            status='pending'
        )
        
        print(f"[DEBUG] ChangeRequest created: id={change_request.id}, object_id={change_request.object_id}")
        
        # Create change request items for each changed field
        for field_change in changed_fields:
            ChangeRequestItem.objects.create(
                change_request=change_request,
                field_name=field_change['field_name'],
                old_value=field_change['old_value'],
                new_value=field_change['new_value']
            )
        
        return change_request
    else:
        print("[DEBUG] No changes detected, no ChangeRequest created.")
    
    return None

def get_object_data(obj, fields):
    """
    Get current data from an object for specified fields
    
    Args:
        obj: Django model instance
        fields: List of field names to extract
    """
    data = {}
    for field in fields:
        if hasattr(obj, field):
            value = getattr(obj, field)
            data[field] = value
    return data 

def deep_delete_by_email(email):
    User = get_user_model()
    # Delete all EmailAccess with this email
    EmailAccess.objects.filter(email=email).delete()
    # Delete all PendingRegistration with this email
    PendingRegistration.objects.filter(user__email=email).delete()
    # Delete all Users with this email
    User.objects.filter(email=email).delete() 