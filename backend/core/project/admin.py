from django.contrib import admin
from .models import Project, Task, TeamMember, ProjectSample


admin.site.register(Project)
admin.site.register(Task)
admin.site.register(TeamMember)
admin.site.register(ProjectSample)