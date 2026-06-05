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
        name = user.full_name or user.email
        plain = f"Hi {name},\n\n{message}\n\n— The OnSwift Team"
        html = f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f3ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">
        <tr><td style="background:#7c3aed;padding:24px 32px;">
          <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-.3px;">OnSwift</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 8px;font-size:11px;font-weight:600;color:#7c3aed;text-transform:uppercase;letter-spacing:.8px;">{title}</p>
          <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">{message}</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">You're receiving this because you have an OnSwift account. Log in at <a href="https://onswift.org" style="color:#7c3aed;text-decoration:none;">onswift.org</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""
        send_email(to_email=user.email, subject=f"OnSwift: {title}", body=plain, html_body=html)

    return notification
