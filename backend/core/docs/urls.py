from django.urls import path
from . import views

urlpatterns = [
    path("docs/", views.DocListCreateView.as_view(), name="doc-list-create"),
    path("docs/<uuid:pk>/", views.DocDetailView.as_view(), name="doc-detail"),
    path("docs/<uuid:pk>/children/", views.DocChildrenView.as_view(), name="doc-children"),
    path("docs/<uuid:pk>/access/", views.DocAccessListView.as_view(), name="doc-access-list"),
    path("docs/<uuid:pk>/access/<uuid:access_id>/", views.DocAccessDetailView.as_view(), name="doc-access-detail"),
    path("users/search/", views.UserSearchView.as_view(), name="user-search"),
    path("sharable-users/", views.DocSharableUsersView.as_view(), name="doc-sharable-users"),
    path("search/", views.GlobalSearchView.as_view(), name="global-search"),
]
