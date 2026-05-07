"""
Google Calendar integration service for syncing task deadlines
"""
from datetime import datetime, timedelta
from typing import Optional, Dict

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from django.conf import settings

from .models import GoogleCalendarToken, CalendarSyncedTask, Task


# Google Calendar API scopes
SCOPES = ['https://www.googleapis.com/auth/calendar.events']


def get_google_credentials(user) -> Optional[Credentials]:
    """Get Google credentials for a user"""
    try:
        token = GoogleCalendarToken.objects.get(user=user)
        creds = Credentials(
            token=token.access_token,
            refresh_token=token.refresh_token,
            token_uri=token.token_uri,
            client_id=token.client_id,
            client_secret=token.client_secret,
            scopes=token.scopes
        )
        
        # Refresh if expired
        if creds.expired and creds.refresh_token:
            creds.refresh(Request())
            # Update stored token
            token.access_token = creds.token
            if creds.expiry:
                token.expiry = creds.expiry
            token.save()
        
        return creds
    except GoogleCalendarToken.DoesNotExist:
        return None
    except Exception as e:
        print(f"Error getting credentials: {e}")
        return None


def get_calendar_service(user):
    """Get Google Calendar service for a user"""
    creds = get_google_credentials(user)
    if not creds:
        return None
    return build('calendar', 'v3', credentials=creds)


def create_calendar_event(user, task: Task) -> Optional[str]:
    """
    Create a Google Calendar event for a task deadline
    Returns the Google event ID if successful
    """
    service = get_calendar_service(user)
    if not service:
        return None
    
    if not task.deadline:
        return None
    
    # Build event data - deadline is a date, create all-day event
    deadline_date = task.deadline.isoformat()
    
    event = {
        'summary': f"[OnSwift] {task.name}",
        'description': f"Project: {task.project.name}\n\n{task.description or 'No description'}\n\nStatus: {task.status}",
        'start': {
            'date': deadline_date,
            'timeZone': 'UTC',
        },
        'end': {
            'date': deadline_date,
            'timeZone': 'UTC',
        },
        'reminders': {
            'useDefault': False,
            'overrides': [
                {'method': 'email', 'minutes': 24 * 60},  # 1 day before
                {'method': 'popup', 'minutes': 60},  # 1 hour before
            ],
        },
        'colorId': _get_color_for_status(task.status),
    }
    
    try:
        created_event = service.events().insert(calendarId='primary', body=event).execute()
        
        # Track the sync
        CalendarSyncedTask.objects.update_or_create(
            task=task,
            user=user,
            defaults={'google_event_id': created_event['id']}
        )
        
        return created_event['id']
    except HttpError as e:
        print(f"Error creating calendar event: {e}")
        return None


def update_calendar_event(user, task: Task) -> bool:
    """Update an existing Google Calendar event for a task"""
    service = get_calendar_service(user)
    if not service:
        return False
    
    try:
        sync = CalendarSyncedTask.objects.get(task=task, user=user)
    except CalendarSyncedTask.DoesNotExist:
        # Not synced yet, create instead
        return create_calendar_event(user, task) is not None
    
    if not task.deadline:
        # No deadline, delete the event
        return delete_calendar_event(user, task)
    
    deadline_date = task.deadline.isoformat()
    
    event = {
        'summary': f"[OnSwift] {task.name}",
        'description': f"Project: {task.project.name}\n\n{task.description or 'No description'}\n\nStatus: {task.status}",
        'start': {
            'date': deadline_date,
            'timeZone': 'UTC',
        },
        'end': {
            'date': deadline_date,
            'timeZone': 'UTC',
        },
        'colorId': _get_color_for_status(task.status),
    }
    
    try:
        service.events().update(
            calendarId='primary',
            eventId=sync.google_event_id,
            body=event
        ).execute()
        return True
    except HttpError as e:
        print(f"Error updating calendar event: {e}")
        return False


def delete_calendar_event(user, task: Task) -> bool:
    """Delete a Google Calendar event for a task"""
    service = get_calendar_service(user)
    if not service:
        return False
    
    try:
        sync = CalendarSyncedTask.objects.get(task=task, user=user)
        service.events().delete(
            calendarId='primary',
            eventId=sync.google_event_id
        ).execute()
        sync.delete()
        return True
    except CalendarSyncedTask.DoesNotExist:
        return True  # Already not synced
    except HttpError as e:
        print(f"Error deleting calendar event: {e}")
        # Still delete the local sync record
        CalendarSyncedTask.objects.filter(task=task, user=user).delete()
        return False


def sync_all_tasks(user) -> Dict[str, int]:
    """Sync all user's task deadlines to Google Calendar"""
    service = get_calendar_service(user)
    if not service:
        return {'success': 0, 'failed': 0, 'error': 'Not connected to Google Calendar'}
    
    # Get all tasks with deadlines for user's projects
    if user.role == 'creator':
        tasks = Task.objects.filter(
            project__creator=user,
            deadline__isnull=False
        )
    else:
        # Talent - get tasks assigned to them
        tasks = Task.objects.filter(
            assignee=user,
            deadline__isnull=False
        )
    
    success = 0
    failed = 0
    
    for task in tasks:
        # Check if already synced
        if CalendarSyncedTask.objects.filter(task=task, user=user).exists():
            if update_calendar_event(user, task):
                success += 1
            else:
                failed += 1
        else:
            if create_calendar_event(user, task):
                success += 1
            else:
                failed += 1
    
    return {'success': success, 'failed': failed}


def _get_color_for_status(status: str) -> str:
    """Map task status to Google Calendar color ID"""
    color_map = {
        'planning': '9',      # Blue
        'in-progress': '5',   # Yellow
        'completed': '10',    # Green
    }
    return color_map.get(status, '9')  # Default blue
