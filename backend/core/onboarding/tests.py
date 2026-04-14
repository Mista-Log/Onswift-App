"""Onboarding tests — slug uniqueness, expiry, and atomic operations."""
from django.test import TestCase
from django.utils import timezone
from datetime import timedelta
from account.models import User
from .models import OnboardingTemplate, OnboardingInstance, _generate_slug


class SlugGenerationTest(TestCase):
    """Test that slug generation produces unique values."""

    def test_slugs_are_unique(self):
        """Generate many slugs and verify no duplicates."""
        slugs = set(_generate_slug() for _ in range(1000))
        self.assertEqual(len(slugs), 1000, "Generated slugs must be unique")

    def test_slug_is_url_safe(self):
        """Slugs should only contain URL-safe characters."""
        import re
        for _ in range(100):
            slug = _generate_slug()
            self.assertRegex(slug, r'^[A-Za-z0-9_-]+$')

    def test_slug_length(self):
        """secrets.token_urlsafe(8) produces an 11-char string."""
        slug = _generate_slug()
        self.assertEqual(len(slug), 11)


class OnboardingInstanceTest(TestCase):
    """Test onboarding instance lifecycle."""

    def setUp(self):
        self.creator = User.objects.create_user(
            email="creator@test.com",
            full_name="Test Creator",
            password="testpass123",
            role="creator",
        )
        self.template = OnboardingTemplate.objects.create(
            creator=self.creator,
            title="Test Template",
            blocks=[{"type": "short_answer", "label": "Name?", "required": True}],
        )

    def test_instance_creation(self):
        """Instance gets a unique slug on creation."""
        instance = OnboardingInstance.objects.create(template=self.template)
        self.assertIsNotNone(instance.slug)
        self.assertEqual(instance.status, "SENT")

    def test_expiry_check(self):
        """Expired instances are detected correctly."""
        # Not expired
        instance = OnboardingInstance.objects.create(
            template=self.template,
            expires_at=timezone.now() + timedelta(days=7),
        )
        self.assertFalse(instance.is_expired)

        # Expired
        instance_expired = OnboardingInstance.objects.create(
            template=self.template,
            expires_at=timezone.now() - timedelta(hours=1),
        )
        self.assertTrue(instance_expired.is_expired)

    def test_no_expiry_means_not_expired(self):
        """Instance with no expires_at is never expired."""
        instance = OnboardingInstance.objects.create(template=self.template)
        self.assertFalse(instance.is_expired)
