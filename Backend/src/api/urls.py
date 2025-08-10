from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ClassViewSet, StudentViewSet, AttendanceViewSet, SubjectViewSet, MarksViewSet, FeeViewSet, ChangeRequestViewSet, MonthlyTestViewSet, TestMarksViewSet, UserRegistrationView, UserLoginView, UserProfileViewSet, PendingRegistrationViewSet, EmailAccessViewSet

router = DefaultRouter()
router.register(r'classes', ClassViewSet)
router.register(r'students', StudentViewSet)
router.register(r'subjects', SubjectViewSet)
router.register(r'marks', MarksViewSet)
router.register(r'attendances', AttendanceViewSet)
router.register(r'fees', FeeViewSet)
router.register(r'change-requests', ChangeRequestViewSet)
router.register(r'monthly-tests', MonthlyTestViewSet)
router.register(r'test-marks', TestMarksViewSet)

# New authentication and user management URLs
router.register(r'user-profiles', UserProfileViewSet)
router.register(r'pending-registrations', PendingRegistrationViewSet)
router.register(r'email-access', EmailAccessViewSet)

urlpatterns = [
    path('', include(router.urls)),
    # Authentication endpoints
    path('auth/register/', UserRegistrationView.as_view(), name='user-register'),
    path('auth/login/', UserLoginView.as_view(), name='user-login'),
]