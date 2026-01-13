from django.contrib import admin
from .models import User, TalentProfile, CreatorProfile

# Register your models here.


admin.site.register(User)
admin.site.register(TalentProfile)
admin.site.register(CreatorProfile)