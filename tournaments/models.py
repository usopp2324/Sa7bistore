from django.conf import settings
from django.db import models


class UserProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='tournament_profile')
    ign_tag = models.CharField(max_length=64, unique=True, null=True, blank=True)
    rank = models.CharField(max_length=64, null=True, blank=True)

    def __str__(self):
        return f"{self.user.username} profile"


class Tournament(models.Model):
    GAMEMODE_CHOICES = [
        ('standard', 'Standard'),
        ('swift', 'Swift'),
        ('skirmish', 'Skirmish'),
    ]

    STATUS_CHOICES = [
        ('waiting_fill', 'Waiting to fill'),
        ('waiting_start', 'Waiting to start'),
        ('live', 'Live'),
        ('ended', 'Ended'),
    ]

    title = models.CharField(max_length=200)
    num_teams = models.PositiveIntegerField()
    team_size = models.PositiveIntegerField()
    gamemode = models.CharField(max_length=20, choices=GAMEMODE_CHOICES, default='standard')
    date = models.DateTimeField()
    prize = models.CharField(max_length=200, blank=True)
    winner = models.ForeignKey('Team', null=True, blank=True, on_delete=models.SET_NULL, related_name='won_tournaments')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='waiting_fill')

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title


class Team(models.Model):
    name = models.CharField(max_length=150)
    members = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='teams')
    tournament = models.ForeignKey(Tournament, related_name='teams', on_delete=models.CASCADE)

    def __str__(self):
        return f"{self.name} ({self.tournament})"


class Match(models.Model):
    tournament = models.ForeignKey(Tournament, related_name='matches', on_delete=models.CASCADE)
    team_a = models.ForeignKey(Team, related_name='home_matches', blank=True, null=True, on_delete=models.SET_NULL)
    team_b = models.ForeignKey(Team, related_name='away_matches', blank=True, null=True, on_delete=models.SET_NULL)
    winner = models.ForeignKey(Team, null=True, blank=True, related_name='matches_won', on_delete=models.SET_NULL)
    loser = models.ForeignKey(Team, null=True, blank=True, related_name='matches_lost', on_delete=models.SET_NULL)
    # Link to the subsequent match this match feeds into, and which slot ('a' or 'b') it should occupy
    next_match = models.ForeignKey('self', null=True, blank=True, related_name='previous_matches', on_delete=models.SET_NULL)
    next_slot = models.CharField(max_length=1, choices=[('a', 'team_a'), ('b', 'team_b')], blank=True)
    score = models.CharField(max_length=64, blank=True)
    date = models.DateTimeField(null=True, blank=True)
    added_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    proof = models.URLField(blank=True)
    round_number = models.PositiveIntegerField(default=1)
    position = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        a = self.team_a.name if self.team_a else 'TBD'
        b = self.team_b.name if self.team_b else 'TBD'
        return f"{a} vs {b} ({self.tournament})"

    def propagate_winner(self):
        if not self.winner or not self.next_match:
            return
        if self.next_slot == 'a':
            if not self.next_match.team_a:
                self.next_match.team_a = self.winner
        else:
            if not self.next_match.team_b:
                self.next_match.team_b = self.winner
        self.next_match.save()

    def save(self, *args, **kwargs):
        # detect if winner has been set (or changed)
        old = None
        if self.pk:
            try:
                old = Match.objects.get(pk=self.pk)
            except Match.DoesNotExist:
                old = None

        super().save(*args, **kwargs)

        # If a winner was set or changed, propagate to next match
        if self.winner and (not old or old.winner_id != self.winner_id):
            # set loser
            if self.team_a and self.team_b:
                if self.winner_id == self.team_a_id:
                    self.loser = self.team_b
                elif self.winner_id == self.team_b_id:
                    self.loser = self.team_a
                super().save(update_fields=['loser'])
            # propagate to next match
            try:
                self.propagate_winner()
            except Exception:
                pass

        # If this is a final match (no next_match) and has a winner, mark tournament winner
        if self.winner and not self.next_match:
            t = self.tournament
            if t.winner_id != self.winner_id:
                t.winner = self.winner
                t.status = 'ended'
                t.save(update_fields=['winner', 'status'])


class Application(models.Model):
    STATUS = [
        ('denied', 'Denied'),
        ('accepted', 'Accepted'),
        ('pending', 'Pending'),
    ]

    applicant = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='tournament_applications', on_delete=models.CASCADE)
    tournament = models.ForeignKey(Tournament, related_name='applications', on_delete=models.CASCADE)
    ign_tag = models.CharField(max_length=64)
    # Optional team name if the applicant is registering as part of a pre-made team
    team_name = models.CharField(max_length=150, blank=True)
    rank = models.CharField(max_length=64)
    age = models.PositiveIntegerField(null=True, blank=True)
    country = models.CharField(max_length=100, blank=True)
    city = models.CharField(max_length=100, blank=True)
    heard_from = models.CharField(max_length=200, blank=True)
    status = models.CharField(max_length=20, choices=STATUS, default='pending')

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('tournament', 'applicant')

    def __str__(self):
        return f"Application: {self.applicant} -> {self.tournament} ({self.status})"
