from .models import Notification
from utils.email_service import send_email


def create_notification(*, user, title, message, notification_type="system", hire_request=None, **kwargs):
    notification = Notification.objects.create(
        user=user,
        title=title,
        message=message,
        notification_type=notification_type,
        hire_request=hire_request,
    )

    # Mirror every in-app notification to the user's email address.
    if user.email:
        body = f"Hi {user.full_name or user.email},\n\n{message}\n\n— The OnSwift Team"
        send_email(to_email=user.email, subject=f"OnSwift: {title}", body=body)

    return notification
