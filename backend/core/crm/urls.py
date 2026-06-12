from django.urls import path
from . import views

urlpatterns = [
    # Sheets
    path("sheets/", views.CRMSheetListCreateView.as_view(), name="crm-sheet-list-create"),
    path("sheets/<uuid:pk>/", views.CRMSheetDetailView.as_view(), name="crm-sheet-detail"),

    # Columns (nested under sheet)
    path("sheets/<uuid:sheet_id>/columns/", views.CRMColumnListCreateView.as_view(), name="crm-column-list-create"),
    path("sheets/<uuid:sheet_id>/columns/<uuid:pk>/", views.CRMColumnDetailView.as_view(), name="crm-column-detail"),

    # Rows (nested under sheet)
    path("sheets/<uuid:sheet_id>/rows/", views.CRMRowListCreateView.as_view(), name="crm-row-list-create"),
    path("sheets/<uuid:sheet_id>/rows/<uuid:pk>/", views.CRMRowDetailView.as_view(), name="crm-row-detail"),

    # Access control (nested under sheet)
    path("sheets/<uuid:sheet_id>/access/", views.CRMAccessListCreateView.as_view(), name="crm-access-list-create"),
    path("sheets/<uuid:sheet_id>/access/<uuid:pk>/", views.CRMAccessDetailView.as_view(), name="crm-access-detail"),

    # Users the creator can share with (accepted team members + onboarded clients)
    path("sharable-users/", views.CRMShareableUsersView.as_view(), name="crm-sharable-users"),
]
