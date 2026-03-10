from django.urls import path
from . import views

app_name = 'tournaments'

urlpatterns = [
    path('', views.tournament_list, name='list'),
    path('<int:pk>/', views.tournament_detail, name='detail'),
    path('<int:pk>/apply/', views.application_create, name='apply'),
    path('applications/', views.applications_list, name='applications'),
    path('applications/<int:pk>/', views.application_detail, name='application_detail'),
    path('match/<int:pk>/', views.match_detail, name='match_detail'),
    path('match/<int:pk>/report/', views.match_report, name='match_report'),
]
