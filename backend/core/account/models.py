from django.db import models
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
import uuid
from cloudinary.models import CloudinaryField



class CustomUserManager(BaseUserManager):
    def create_user(self, email, full_name, password=None, **extra_fields):
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email)
        user = self.model(email=email, full_name=full_name, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, full_name, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")

        return self.create_user(email, full_name, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    ROLE_CHOICES = (
        ('creator', 'Creator'),
        ('talent', 'Talent'),
    )
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)
    profile_picture = CloudinaryField(
        "profile_picture",
        blank=True,
        null=True
    )
    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=255, blank=True, null=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)


    USERNAME_FIELD = "email" 
    REQUIRED_FIELDS = ['full_name']
    
    objects = CustomUserManager()

    def __str__(self):
        return f"{self.full_name} ({self.email})"


class TalentProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    professional_title = models.CharField(max_length=255)
    bio = models.TextField(blank=True)
    skills = models.JSONField(default=list)
    primary_skill = models.CharField(max_length=100)
    hourly_rate = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    portfolio_links = models.JSONField(default=list, blank=True)
    availability = models.CharField(max_length=100, blank=True)

    def __str__(self):
        return f"Talent: {self.user.full_name or self.user.email}"

class CreatorProfile(models.Model):
    user = models.OneToOneField(
        User, 
        on_delete=models.CASCADE,
    )

    social_links = models.JSONField(default=dict, blank=True)
    company_name = models.CharField(max_length=255, blank=True)
    bio = models.TextField(blank=True)
    website = models.URLField(blank=True)
    industry = models.CharField(max_length=150, blank=True)
    location = models.CharField(max_length=255, blank=True)
    verified = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Creator: {self.user.full_name or self.user.email}"
