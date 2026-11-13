"""Profile previews and the "Featured" section.

What a creator sees when they open a team member's profile (and what a talent sees of the creator who
hired them) is built here, from one place, so the profile page and the live preview on the edit pages
always match. Email addresses are never included.
"""
import re

from django.db import IntegrityError, transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import permissions, serializers, status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from core.exceptions import storage_error_guard
from notification.models import HireRequest
from project.models import Project, Task

from .models import CreatorProfile, FeaturedWork, User

MAX_IMAGE_BYTES = 5 * 1024 * 1024


def _url(value):
    """A Cloudinary field's public URL, or None when it holds nothing."""
    try:
        return value.url if value else None
    except Exception:
        return None


def can_view_profile(viewer, target):
    """You can open your own profile, or the profile of someone you work with (an accepted hire either way)."""
    if viewer.id == target.id:
        return True
    return HireRequest.objects.filter(status="accepted").filter(
        Q(creator=viewer, talent=target) | Q(creator=target, talent=viewer)
    ).exists()


def _work_dict(w):
    return {"id": str(w.id), "title": w.title, "link": w.link, "image": _url(w.image)}


def _stats(user):
    featured = user.featured_works.count()
    if user.role == "talent":
        return [
            {"label": "Projects", "value": Project.objects.filter(tasks__assignees=user).distinct().count()},
            {"label": "Tasks done", "value": Task.objects.filter(assignees=user, status="completed").count()},
            {"label": "Featured", "value": featured},
        ]
    return [
        {"label": "Projects", "value": Project.objects.filter(creator=user).count()},
        {"label": "Team", "value": HireRequest.objects.filter(creator=user, status="accepted").count()},
        {"label": "Featured", "value": featured},
    ]


def build_profile(user):
    """The profile as others see it. Deliberately limited: no email, no rates, no private fields."""
    base = {
        "id": str(user.id),
        "role": user.role,
        "full_name": user.full_name or "",
        "avatar": _url(user.profile_picture),
        "banner": _url(user.banner),
        "member_since": user.date_joined.year if user.date_joined else None,
        "featured": [_work_dict(w) for w in user.featured_works.all()],
        "stats": _stats(user),
    }
    if user.role == "talent":
        p = getattr(user, "talentprofile", None)
        base.update({
            "headline": (p.professional_title if p else "") or "",
            "bio": (p.bio if p else "") or "",
            "skills": (p.skills if p else []) or [],
            "links": (p.portfolio_links if p else []) or [],
            "social_links": (p.social_links if p else {}) or {},
        })
    else:
        p = getattr(user, "creatorprofile", None)
        base.update({
            "headline": (p.company_name if p else "") or "",
            "bio": (p.bio if p else "") or "",
            "skills": [],
            "links": ([*(p.portfolio_links or []), *([p.website] if p.website else [])] if p else []),
            "social_links": (p.social_links if p else {}) or {},
        })
    return base


def shared_profile(user):
    """The profile as shown outside the app (a public link, or a form the creator put it on).

    Same content as inside the app, minus the internal user id. `handle` is only included while the
    public link is on, so a form can link to the full page without revealing a switched-off handle.
    """
    data = build_profile(user)
    data.pop("id", None)
    p = getattr(user, "creatorprofile", None)
    data["handle"] = p.handle if (p and p.is_public and p.handle) else None
    return data


# ── Public share link: onswift.org/<handle> ──────────────────────────────────

HANDLE_MIN, HANDLE_MAX = 3, 30
# Letters and numbers, separated by single dots, dashes or underscores: "ada.lovelace", "studio-x".
HANDLE_RE = re.compile(r"^[a-z0-9]+(?:[._-][a-z0-9]+)*$")
# A handle is the first part of the address, so it must never collide with a page of the app...
RESERVED_HANDLES = frozenset("""
    admin blog login get-started signup forgot-password verify-email invite home chat dashboard talent
    team projects calendar analytics settings profile messages deliverables reset-password auth
    onboarding onboard forms f portal library notifications tools docs api assets static media public
    onswift support help about pricing terms privacy contact www app index favicon robots sitemap
    null undefined me you
""".split())
# ...or look like a file the web server would serve instead ("robots.txt", "logo.png").
FILE_ENDINGS = frozenset(
    "html htm js mjs css json xml txt ico png jpg jpeg gif svg webp avif map woff woff2 ttf pdf php".split()
)


def clean_handle(raw):
    """Normalise and validate a handle. Returns it lowercase, or raises a ValidationError saying why not."""
    handle = (raw or "").strip().lower().lstrip("@")
    if not (HANDLE_MIN <= len(handle) <= HANDLE_MAX):
        raise serializers.ValidationError(f"Use between {HANDLE_MIN} and {HANDLE_MAX} characters.")
    if not HANDLE_RE.match(handle):
        raise serializers.ValidationError(
            "Use letters and numbers, with single dots, dashes or underscores in between (like ada.lovelace)."
        )
    looks_like_a_file = "." in handle and handle.rsplit(".", 1)[-1] in FILE_ENDINGS
    if handle in RESERVED_HANDLES or looks_like_a_file:
        raise serializers.ValidationError("That link isn't available. Try another.")
    return handle


def suggest_handle(user):
    """A free handle based on the person's name: "Ada Lovelace" -> "ada.lovelace" (then ada.lovelace2...)."""
    words = re.findall(r"[a-z0-9]+", (user.full_name or "").lower())
    base = ".".join(words)[:HANDLE_MAX - 3].strip(".") or "creator"
    try:
        base = clean_handle(base)
    except serializers.ValidationError:
        base = "creator"
    candidate, n = base, 1
    while candidate in RESERVED_HANDLES or CreatorProfile.objects.filter(handle=candidate).exclude(user=user).exists():
        n += 1
        candidate = f"{base}{n}"
    return candidate


class MyShareLinkView(APIView):
    """A creator's own public link: read it, rename it, switch it on or off."""
    permission_classes = [permissions.IsAuthenticated]

    def _profile(self, request):
        if request.user.role != "creator":
            return None
        return CreatorProfile.objects.get_or_create(user=request.user)[0]

    def _payload(self, request, p):
        return {"handle": p.handle, "suggested_handle": p.handle or suggest_handle(request.user), "is_public": p.is_public}

    def _denied(self):
        return Response(
            {"detail": "Public profile links are part of creator accounts."}, status=status.HTTP_403_FORBIDDEN
        )

    def get(self, request):
        p = self._profile(request)
        return Response(self._payload(request, p)) if p else self._denied()

    def patch(self, request):
        p = self._profile(request)
        if not p:
            return self._denied()
        if "handle" in request.data:
            try:
                handle = clean_handle(request.data.get("handle"))
            except serializers.ValidationError as e:
                return Response({"handle": e.detail}, status=status.HTTP_400_BAD_REQUEST)
            if CreatorProfile.objects.filter(handle=handle).exclude(pk=p.pk).exists():
                return Response({"handle": ["That link is taken. Try another."]}, status=status.HTTP_400_BAD_REQUEST)
            p.handle = handle
        if "is_public" in request.data:
            p.is_public = request.data.get("is_public") in (True, "true", "True", "1", 1)
        if p.is_public and not p.handle:
            return Response({"handle": ["Choose your link first."]}, status=status.HTTP_400_BAD_REQUEST)
        try:
            with transaction.atomic():
                p.save(update_fields=["handle", "is_public"])
        except IntegrityError:
            # Someone took it between the check and the save.
            return Response({"handle": ["That link is taken. Try another."]}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self._payload(request, p))


class ProfileByHandleView(APIView):
    """onswift.org/<handle>: open to anyone, signed in or not, but only while the creator has it switched on."""
    authentication_classes = []
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "public_profile"

    def get(self, request, handle):
        p = CreatorProfile.objects.select_related("user").filter(
            handle=(handle or "").lower(), is_public=True, user__is_active=True, user__role="creator"
        ).first()
        # A switched-off link and one that never existed look the same from outside.
        if not p:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(shared_profile(p.user))


class PublicProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, user_id):
        target = get_object_or_404(User, pk=user_id, is_active=True)
        # 404, not 403: don't confirm that someone you don't work with exists.
        if not can_view_profile(request.user, target):
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(build_profile(target))


class FeaturedWorkInputSerializer(serializers.Serializer):
    image = serializers.ImageField(required=False)
    title = serializers.CharField(required=False, allow_blank=True, max_length=120)
    link = serializers.URLField(required=False, allow_blank=True)

    def validate_image(self, f):
        if f.size > MAX_IMAGE_BYTES:
            raise serializers.ValidationError("Images can be up to 5MB.")
        return f


class MyFeaturedWorkView(APIView):
    """Your own Featured section: list it, or add an image (with an optional title and link)."""
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request):
        return Response([_work_dict(w) for w in request.user.featured_works.all()])

    def post(self, request):
        if request.user.featured_works.count() >= FeaturedWork.MAX_PER_USER:
            return Response(
                {"detail": f"You can feature up to {FeaturedWork.MAX_PER_USER} pieces. Remove one to add another."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        s = FeaturedWorkInputSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        if "image" not in s.validated_data:
            return Response({"detail": "Choose an image to feature."}, status=status.HTTP_400_BAD_REQUEST)
        with storage_error_guard():
            work = FeaturedWork.objects.create(user=request.user, **s.validated_data)
        return Response(_work_dict(work), status=status.HTTP_201_CREATED)


class MyFeaturedWorkDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def _own(self, request, pk):
        # Someone else's piece is a 404, same as one that doesn't exist.
        return get_object_or_404(FeaturedWork, pk=pk, user=request.user)

    def patch(self, request, pk):
        work = self._own(request, pk)
        s = FeaturedWorkInputSerializer(data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        for field in ("title", "link"):
            if field in s.validated_data:
                setattr(work, field, s.validated_data[field])
        work.save(update_fields=["title", "link"])
        return Response(_work_dict(work))

    def delete(self, request, pk):
        self._own(request, pk).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
