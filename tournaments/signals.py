from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Application, Team, Match
import math


def _create_full_bracket(tournament):
    teams = list(tournament.teams.all())
    n = max(1, tournament.num_teams)
    # next power of two >= n
    m = 1
    while m < n:
        m *= 2
    rounds = int(math.log2(m))

    slots = teams[:] + [None] * (m - len(teams))

    position_counter = 0
    rounds_matches = {}

    for r in range(1, rounds + 1):
        rounds_matches[r] = []
        matches_in_round = m // (2 ** r)
        if r == 1:
            for i in range(0, m, 2):
                position_counter += 1
                a = slots[i]
                b = slots[i+1]
                match = Match.objects.create(tournament=tournament, team_a=a if a else None, team_b=b if b else None, score='', date=None, round_number=1, position=position_counter)
                rounds_matches[r].append(match)
        else:
            for p in range(matches_in_round):
                position_counter += 1
                match = Match.objects.create(tournament=tournament, team_a=None, team_b=None, score='', date=None, round_number=r, position=position_counter)
                rounds_matches[r].append(match)

    # link next_match and next_slot
    for r in range(1, rounds):
        for idx, mobj in enumerate(rounds_matches[r]):
            next_idx = idx // 2
            next_match = rounds_matches[r+1][next_idx]
            mobj.next_match = next_match
            mobj.next_slot = 'a' if (idx % 2) == 0 else 'b'
            mobj.save(update_fields=['next_match', 'next_slot'])

    # auto-advance byes
    for r in range(1, rounds + 1):
        for mobj in rounds_matches[r]:
            if mobj.team_a and not mobj.team_b:
                mobj.winner = mobj.team_a
                mobj.save()
            elif mobj.team_b and not mobj.team_a:
                mobj.winner = mobj.team_b
                mobj.save()


def _place_team_into_existing_bracket(tournament, team):
    # find first round 1 match with empty slot
    first_round = Match.objects.filter(tournament=tournament, round_number=1).order_by('position')
    for m in first_round:
        if not m.team_a:
            m.team_a = team
            m.save()
            return m
        if not m.team_b:
            m.team_b = team
            m.save()
            return m
    return None


def ensure_bracket_and_place_team(tournament, team):
    # If no matches exist, create full bracket using current teams
    if tournament.matches.count() == 0:
        _create_full_bracket(tournament)
        return

    # otherwise, place into first empty slot
    placed = _place_team_into_existing_bracket(tournament, team)
    if placed:
        # if the match now has only one team, auto-advance
        if (placed.team_a and not placed.team_b) or (placed.team_b and not placed.team_a):
            placed.winner = placed.team_a or placed.team_b
            placed.save()


@receiver(post_save, sender=Application)
def on_application_status_change(sender, instance, created, **kwargs):
    # When an application is accepted, ensure a team exists and place into bracket
    if instance.status != 'accepted':
        return

    tournament = instance.tournament

    # determine team: prefer provided team_name
    team = None
    if instance.team_name:
        team, _ = Team.objects.get_or_create(name=instance.team_name.strip(), tournament=tournament)
    else:
        # create a team per applicant if team_size == 1, otherwise try to find a team with space
        if tournament.team_size == 1:
            name = f"{instance.applicant.username}"
            team, _ = Team.objects.get_or_create(name=name, tournament=tournament)
        else:
            # try to find an existing partially filled team without a specific team_name
            teams = list(tournament.teams.all())
            found = None
            for t in teams:
                if t.members.count() < tournament.team_size and not t.name.lower().startswith('team '):
                    found = t
                    break
            if found:
                team = found
            else:
                # create a new generic team
                existing = tournament.teams.count() + 1
                name = f"Team {existing}"
                team = Team.objects.create(name=name, tournament=tournament)

    # add member if not already
    if team and not team.members.filter(id=instance.applicant.id).exists():
        team.members.add(instance.applicant)

    # ensure bracket and place team
    try:
        ensure_bracket_and_place_team(tournament, team)
    except Exception:
        pass
