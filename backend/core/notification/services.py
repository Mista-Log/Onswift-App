from .models import Notification 


def create_notification(*, user, title, message, notification_type="system", hire_request=None):
    return Notification.objects.create(
        user=user,
        title=title,
        message=message,
        notification_type=notification_type,
        hire_request=hire_request,
    )
