from django.contrib import admin
from . import models


@admin.register(models.Tournament)
class TournamentAdmin(admin.ModelAdmin):
    list_display = ('title', 'date', 'gamemode', 'status')
    list_filter = ('gamemode', 'status')


@admin.register(models.Team)
class TeamAdmin(admin.ModelAdmin):
    list_display = ('name', 'tournament')
    filter_horizontal = ('members',)


@admin.register(models.Match)
class MatchAdmin(admin.ModelAdmin):
    list_display = ('tournament', 'team_a', 'team_b', 'winner', 'score', 'round_number', 'position', 'date')


@admin.register(models.Application)
class ApplicationAdmin(admin.ModelAdmin):
    list_display = ('applicant', 'tournament', 'ign_tag', 'rank', 'status')
    list_filter = ('status',)


@admin.register(models.UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'ign_tag', 'rank')
