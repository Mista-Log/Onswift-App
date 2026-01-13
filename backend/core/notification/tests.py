from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from django.utils import timezone
from datetime import timedelta
from account.models import User, TalentProfile, CreatorProfile
from .models import InviteToken, HireRequest, Notification


class InviteTokenTestCase(TestCase):
    """Test cases for Invite Link feature"""

    def setUp(self):
        """Set up test data"""
        # Create creator user
        self.creator = User.objects.create_user(
            email="creator@test.com",
            password="testpass123",
            full_name="Test Creator",
            role="creator"
        )
        CreatorProfile.objects.create(
            user=self.creator,
            company_name="Test Company"
        )

        # Create talent user
        self.talent = User.objects.create_user(
            email="talent@test.com",
            password="testpass123",
            full_name="Test Talent",
            role="talent"
        )
        TalentProfile.objects.create(
            user=self.talent,
            professional_title="Test Developer"
        )

        self.client = APIClient()

    def test_creator_can_generate_invite_token(self):
        """Test that creators can generate invite tokens"""
        self.client.force_authenticate(user=self.creator)

        url = '/api/v3/invites/generate/'
        response = self.client.post(
            url,
            data={"invited_email": "newtalent@test.com"},
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('token', response.data)
        self.assertIn('invite_url', response.data)
        self.assertEqual(response.data['invited_email'], 'newtalent@test.com')

        # Verify token was created in database
        invite = InviteToken.objects.get(token=response.data['token'])
        self.assertEqual(invite.creator, self.creator)
        self.assertFalse(invite.is_used)

    def test_talent_cannot_generate_invite_token(self):
        """Test that talents cannot generate invite tokens"""
        self.client.force_authenticate(user=self.talent)

        url = '/api/v3/invites/generate/'
        response = self.client.post(url, data={}, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_invite_token_auto_generates_unique_token(self):
        """Test that invite tokens are auto-generated and unique"""
        invite1 = InviteToken.objects.create(creator=self.creator)
        invite2 = InviteToken.objects.create(creator=self.creator)

        self.assertIsNotNone(invite1.token)
        self.assertIsNotNone(invite2.token)
        self.assertNotEqual(invite1.token, invite2.token)

    def test_invite_token_auto_sets_expiry(self):
        """Test that invite tokens auto-set expiry to 7 days"""
        invite = InviteToken.objects.create(creator=self.creator)

        # Check expiry is approximately 7 days from now
        expected_expiry = timezone.now() + timedelta(days=7)
        delta = abs((invite.expires_at - expected_expiry).total_seconds())

        self.assertLess(delta, 60)  # Within 1 minute

    def test_validate_valid_invite_token(self):
        """Test validating a valid invite token"""
        invite = InviteToken.objects.create(creator=self.creator)

        url = f'/api/v3/invites/validate/{invite.token}/'
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['is_valid'])
        self.assertEqual(response.data['creator_name'], self.creator.full_name)
        self.assertEqual(response.data['creator_company'], 'Test Company')

    def test_validate_expired_invite_token(self):
        """Test validating an expired invite token"""
        invite = InviteToken.objects.create(
            creator=self.creator,
            expires_at=timezone.now() - timedelta(days=1)  # Expired
        )

        url = f'/api/v3/invites/validate/{invite.token}/'
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data['is_valid'])

    def test_validate_used_invite_token(self):
        """Test validating an already used invite token"""
        invite = InviteToken.objects.create(
            creator=self.creator,
            is_used=True,
            used_by=self.talent,
            used_at=timezone.now()
        )

        url = f'/api/v3/invites/validate/{invite.token}/'
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data['is_valid'])

    def test_validate_invalid_invite_token(self):
        """Test validating a non-existent invite token"""
        url = '/api/v3/invites/validate/invalid-token-123/'
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_signup_with_valid_invite_token(self):
        """Test talent signup with valid invite token"""
        invite = InviteToken.objects.create(creator=self.creator)

        url = '/api/v1/auth/signup/'
        response = self.client.post(
            url,
            data={
                "email": "newtalent@test.com",
                "full_name": "New Talent",
                "password": "testpass123",
                "role": "talent",
                "professional_title": "Designer",
                "skills": ["UI/UX", "Figma"],
                "primary_skill": "UI/UX",
                "invite_token": invite.token
            },
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Verify invite was marked as used
        invite.refresh_from_db()
        self.assertTrue(invite.is_used)
        self.assertIsNotNone(invite.used_by)
        self.assertIsNotNone(invite.used_at)

        # Verify hire request was created with accepted status
        hire_request = HireRequest.objects.get(
            creator=self.creator,
            talent=invite.used_by
        )
        self.assertEqual(hire_request.status, 'accepted')

    def test_signup_with_invalid_invite_token(self):
        """Test signup with invalid invite token (should still create user but ignore token)"""
        url = '/api/v1/auth/signup/'
        response = self.client.post(
            url,
            data={
                "email": "newtalent@test.com",
                "full_name": "New Talent",
                "password": "testpass123",
                "role": "talent",
                "professional_title": "Designer",
                "skills": ["UI/UX"],
                "primary_skill": "UI/UX",
                "invite_token": "invalid-token"
            },
            format='json'
        )

        # Should still create user, just ignore invalid token
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Verify no hire request was created
        self.assertEqual(HireRequest.objects.count(), 0)

    def test_signup_with_expired_invite_token(self):
        """Test signup with expired invite token"""
        invite = InviteToken.objects.create(
            creator=self.creator,
            expires_at=timezone.now() - timedelta(days=1)
        )

        url = '/api/v1/auth/signup/'
        response = self.client.post(
            url,
            data={
                "email": "newtalent@test.com",
                "full_name": "New Talent",
                "password": "testpass123",
                "role": "talent",
                "professional_title": "Designer",
                "skills": ["UI/UX"],
                "primary_skill": "UI/UX",
                "invite_token": invite.token
            },
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Verify invite was not marked as used
        invite.refresh_from_db()
        self.assertFalse(invite.is_used)

        # Verify no hire request was created
        self.assertEqual(HireRequest.objects.count(), 0)

    def test_invite_token_is_valid_method(self):
        """Test the is_valid() method on InviteToken model"""
        # Valid token
        valid_invite = InviteToken.objects.create(creator=self.creator)
        self.assertTrue(valid_invite.is_valid())

        # Used token
        used_invite = InviteToken.objects.create(
            creator=self.creator,
            is_used=True
        )
        self.assertFalse(used_invite.is_valid())

        # Expired token
        expired_invite = InviteToken.objects.create(
            creator=self.creator,
            expires_at=timezone.now() - timedelta(hours=1)
        )
        self.assertFalse(expired_invite.is_valid())


class NotificationTestCase(TestCase):
    """Test cases for Notification system"""

    def setUp(self):
        """Set up test data"""
        # Create users
        self.creator = User.objects.create_user(
            email="creator@test.com",
            password="testpass123",
            full_name="Test Creator",
            role="creator"
        )
        CreatorProfile.objects.create(user=self.creator)

        self.talent = User.objects.create_user(
            email="talent@test.com",
            password="testpass123",
            full_name="Test Talent",
            role="talent"
        )
        TalentProfile.objects.create(
            user=self.talent,
            professional_title="Developer"
        )

        self.client = APIClient()

    def test_list_user_notifications(self):
        """Test listing notifications for authenticated user"""
        # Create notifications for talent
        Notification.objects.create(
            user=self.talent,
            title="Test Notification 1",
            message="Test message 1",
            notification_type="system"
        )
        Notification.objects.create(
            user=self.talent,
            title="Test Notification 2",
            message="Test message 2",
            notification_type="hire"
        )

        # Create notification for creator (should not appear)
        Notification.objects.create(
            user=self.creator,
            title="Creator Notification",
            message="Creator message",
            notification_type="system"
        )

        self.client.force_authenticate(user=self.talent)
        url = '/api/v3/notifications/'
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

        # Verify ordering (newest first)
        self.assertEqual(response.data[0]['title'], 'Test Notification 2')

    def test_mark_notification_as_read(self):
        """Test marking a notification as read"""
        notification = Notification.objects.create(
            user=self.talent,
            title="Test Notification",
            message="Test message",
            notification_type="system",
            is_read=False
        )

        self.client.force_authenticate(user=self.talent)
        url = f'/api/v3/notifications/{notification.id}/read/'
        response = self.client.patch(url, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify notification is marked as read
        notification.refresh_from_db()
        self.assertTrue(notification.is_read)

    def test_user_cannot_read_others_notifications(self):
        """Test that users cannot access other users' notifications"""
        notification = Notification.objects.create(
            user=self.creator,
            title="Creator Notification",
            message="Creator message",
            notification_type="system"
        )

        self.client.force_authenticate(user=self.talent)
        url = f'/api/v3/notifications/{notification.id}/read/'
        response = self.client.patch(url, format='json')

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_hire_request_creates_notification_for_talent(self):
        """Test that creating a hire request creates a notification for talent"""
        self.client.force_authenticate(user=self.creator)

        url = '/api/v3/hire-requests/'
        response = self.client.post(
            url,
            data={
                "talent": str(self.talent.id),
                "message": "I'd like to hire you"
            },
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Verify notification was created for talent
        notification = Notification.objects.get(user=self.talent)
        self.assertEqual(notification.notification_type, 'hire')
        self.assertIn(self.creator.full_name, notification.message)
        self.assertIsNotNone(notification.hire_request)

    def test_hire_request_response_creates_notification_for_creator(self):
        """Test that responding to hire request creates notification for creator"""
        # Create hire request
        hire_request = HireRequest.objects.create(
            creator=self.creator,
            talent=self.talent,
            message="Please join our team"
        )

        self.client.force_authenticate(user=self.talent)
        url = f'/api/v3/hire-requests/{hire_request.id}/respond/'
        response = self.client.patch(
            url,
            data={"status": "accepted"},
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify notification was created for creator
        notification = Notification.objects.get(
            user=self.creator,
            hire_request=hire_request
        )
        self.assertEqual(notification.notification_type, 'hire')
        self.assertIn('accepted', notification.message)
        self.assertIn(self.talent.full_name, notification.message)

    def test_notification_ordering(self):
        """Test that notifications are ordered by created_at descending"""
        # Create notifications with different timestamps
        old_notification = Notification.objects.create(
            user=self.talent,
            title="Old Notification",
            message="Old message",
            notification_type="system"
        )

        new_notification = Notification.objects.create(
            user=self.talent,
            title="New Notification",
            message="New message",
            notification_type="system"
        )

        self.client.force_authenticate(user=self.talent)
        url = '/api/v3/notifications/'
        response = self.client.get(url)

        self.assertEqual(response.data[0]['id'], str(new_notification.id))
        self.assertEqual(response.data[1]['id'], str(old_notification.id))

    def test_unauthenticated_cannot_access_notifications(self):
        """Test that unauthenticated users cannot access notifications"""
        url = '/api/v3/notifications/'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class HireRequestTestCase(TestCase):
    """Test cases for Hire Request functionality"""

    def setUp(self):
        """Set up test data"""
        self.creator = User.objects.create_user(
            email="creator@test.com",
            password="testpass123",
            full_name="Test Creator",
            role="creator"
        )
        CreatorProfile.objects.create(user=self.creator)

        self.talent = User.objects.create_user(
            email="talent@test.com",
            password="testpass123",
            full_name="Test Talent",
            role="talent"
        )
        TalentProfile.objects.create(
            user=self.talent,
            professional_title="Developer"
        )

        self.client = APIClient()

    def test_creator_can_send_hire_request(self):
        """Test that creators can send hire requests"""
        self.client.force_authenticate(user=self.creator)

        url = '/api/v3/hire-requests/'
        response = self.client.post(
            url,
            data={
                "talent": str(self.talent.id),
                "message": "Join our team!"
            },
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Verify hire request was created
        hire_request = HireRequest.objects.get(
            creator=self.creator,
            talent=self.talent
        )
        self.assertEqual(hire_request.status, 'pending')
        self.assertEqual(hire_request.message, 'Join our team!')

    def test_talent_cannot_send_hire_request(self):
        """Test that talents cannot send hire requests"""
        self.client.force_authenticate(user=self.talent)

        url = '/api/v3/hire-requests/'
        response = self.client.post(
            url,
            data={
                "talent": str(self.creator.id),
                "message": "Hire me!"
            },
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_talent_can_accept_hire_request(self):
        """Test that talents can accept hire requests"""
        hire_request = HireRequest.objects.create(
            creator=self.creator,
            talent=self.talent,
            message="Join us!"
        )

        self.client.force_authenticate(user=self.talent)
        url = f'/api/v3/hire-requests/{hire_request.id}/respond/'
        response = self.client.patch(
            url,
            data={"status": "accepted"},
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        hire_request.refresh_from_db()
        self.assertEqual(hire_request.status, 'accepted')
        self.assertIsNotNone(hire_request.responded_at)

    def test_talent_can_reject_hire_request(self):
        """Test that talents can reject hire requests"""
        hire_request = HireRequest.objects.create(
            creator=self.creator,
            talent=self.talent,
            message="Join us!"
        )

        self.client.force_authenticate(user=self.talent)
        url = f'/api/v3/hire-requests/{hire_request.id}/respond/'
        response = self.client.patch(
            url,
            data={"status": "rejected"},
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        hire_request.refresh_from_db()
        self.assertEqual(hire_request.status, 'rejected')

    def test_creator_team_list_shows_accepted_hires(self):
        """Test that creators can see their accepted team members"""
        # Create accepted hire request
        HireRequest.objects.create(
            creator=self.creator,
            talent=self.talent,
            status='accepted',
            responded_at=timezone.now()
        )

        # Create pending hire request (should not appear)
        other_talent = User.objects.create_user(
            email="other@test.com",
            password="testpass123",
            full_name="Other Talent",
            role="talent"
        )
        TalentProfile.objects.create(
            user=other_talent,
            professional_title="Designer"
        )
        HireRequest.objects.create(
            creator=self.creator,
            talent=other_talent,
            status='pending'
        )

        self.client.force_authenticate(user=self.creator)
        url = '/api/v3/team/'
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['name'], self.talent.full_name)
