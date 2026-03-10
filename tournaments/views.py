from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.decorators import login_required
from .models import Tournament, Application, Match, Team
from django.contrib import messages
import json
import random
import re


def tournament_list(request):
    tournaments = Tournament.objects.all().order_by('date')
    return render(request, 'tournaments/list.html', {'tournaments': tournaments})


def tournament_detail(request, pk):
    tournament = get_object_or_404(Tournament, pk=pk)
    # Auto-generate teams for skirmish (2v2) if enough applications and no teams exist yet.
    bracket_data = None
    if tournament.gamemode == 'skirmish':
        # enforce team_size for skirmish
        tournament.team_size = 2
        tournament.save(update_fields=['team_size'])

    # If there are applications with explicit team_name, create teams for those groups
    apps = list(tournament.applications.all())
    team_name_groups = {}
    for a in apps:
        if a.team_name:
            team_name_groups.setdefault(a.team_name.strip(), []).append(a)
    for tn, group in team_name_groups.items():
        # create team if not exists
        if not tournament.teams.filter(name__iexact=tn).exists():
            members = [g.applicant for g in group]
            team = Team.objects.create(name=tn, tournament=tournament)
            team.members.set(members)

    # If there are no teams, form as many full teams as possible from remaining applications
    existing_teams = tournament.teams.count()
    team_size = tournament.team_size or 1
    # number of full teams we can form from available applicants
    # exclude applications that are already assigned to teams (by team_name)
    assigned_user_ids = set()
    for t in tournament.teams.all():
        assigned_user_ids.update(u.id for u in t.members.all())
    remaining_apps = [a for a in apps if a.applicant.id not in assigned_user_ids]
    possible_teams = min(tournament.num_teams - existing_teams, len(remaining_apps) // team_size) if team_size > 0 else 0
    if existing_teams == 0 and possible_teams > 0:
        applicants = [a for a in remaining_apps]
        random.shuffle(applicants)
        teams_created = []
        for i in range(possible_teams):
            if not applicants:
                break
            # start with first applicant
            a = applicants.pop(0)
            members = [a.applicant]
            # try to pair with applicants with same team_name first
            if a.team_name:
                same_idx = next((idx for idx, x in enumerate(applicants) if x.team_name == a.team_name and x.applicant != a.applicant), None)
                if same_idx is not None:
                    matched = applicants.pop(same_idx)
                    members.append(matched.applicant)
            # fill remaining slots with next applicants
            while len(members) < team_size and applicants:
                g = applicants.pop(0)
                members.append(g.applicant)

            team_name = a.team_name or f"Team {i+1}"
            team = Team.objects.create(name=team_name, tournament=tournament)
            team.members.set(members)
            teams_created.append({
                'id': team.id,
                'name': team.name,
                'members': [m.username for m in members]
            })

    # Prepare bracket data from teams and matches for front-end renderer
    teams = list(tournament.teams.all())
    # If we have enough teams to fill the tournament and no matches exist, create a full single-elimination bracket
    if len(teams) >= tournament.num_teams and tournament.matches.count() == 0:
        import math
        # select exactly num_teams teams
        selectable = teams[:]
        random.shuffle(selectable)
        selectable = selectable[:tournament.num_teams]

        n = len(selectable)
        # next power of two >= n
        m = 1
        while m < n:
            m *= 2
        rounds = int(math.log2(m))

        # create slots: place teams first then None for byes
        slots = selectable[:] + [None] * (m - n)

        position_counter = 0
        rounds_matches = {}

        # create matches round by round and keep references to update propagation
        for r in range(1, rounds + 1):
            rounds_matches[r] = []
            matches_in_round = m // (2 ** r)
            if r == 1:
                # pair slots
                for i in range(0, m, 2):
                    position_counter += 1
                    a = slots[i]
                    b = slots[i+1]
                    match = Match.objects.create(tournament=tournament, team_a=a if a else None, team_b=b if b else None, score='', date=None, round_number=1, position=position_counter)
                    rounds_matches[r].append(match)
            else:
                # create empty placeholder matches (teams will be linked from previous round winners)
                for p in range(matches_in_round):
                    position_counter += 1
                    match = Match.objects.create(tournament=tournament, team_a=None, team_b=None, score='', date=None, round_number=r, position=position_counter)
                    rounds_matches[r].append(match)

        # Link matches across rounds so each match knows the next match and slot
        for r in range(1, rounds):
            for idx, mobj in enumerate(rounds_matches[r]):
                next_idx = idx // 2
                next_match = rounds_matches[r+1][next_idx]
                mobj.next_match = next_match
                mobj.next_slot = 'a' if (idx % 2) == 0 else 'b'
                mobj.save(update_fields=['next_match', 'next_slot'])

        # Auto-advance byes and single-team matches
        for r in range(1, rounds + 1):
            for mobj in rounds_matches[r]:
                if mobj.team_a and not mobj.team_b:
                    mobj.winner = mobj.team_a
                    mobj.save()
                elif mobj.team_b and not mobj.team_a:
                    mobj.winner = mobj.team_b
                    mobj.save()

    matches = list(tournament.matches.all())

    # Determine round count dynamically based on tournament.num_teams (or existing matches)
    import math
    num_teams_for_rounds = max(len(teams), tournament.num_teams or 0)
    if num_teams_for_rounds < 1:
        num_teams_for_rounds = 1
    m = 1
    while m < num_teams_for_rounds:
        m *= 2
    rounds = int(math.log2(m)) if m > 0 else 1

    # Group matches by round for easier frontend rendering (ordered by position)
    matches_serialized = []
    for mobj in matches:
        matches_serialized.append({'id': mobj.id, 'team_a': mobj.team_a.id if mobj.team_a else None, 'team_b': mobj.team_b.id if mobj.team_b else None, 'score': mobj.score, 'winner': mobj.winner.id if mobj.winner else None, 'round_number': mobj.round_number, 'position': mobj.position})

    bracket_data = {
        'teams': [{'id': t.id, 'name': t.name, 'members': [u.username for u in t.members.all()]} for t in teams],
        'matches': matches_serialized,
        'rounds': rounds,
        'slots': m,
    }

    return render(request, 'tournaments/detail.html', {'tournament': tournament, 'bracket_data': json.dumps(bracket_data)})


@login_required(login_url='shop:login')
def application_create(request, pk):
    tournament = get_object_or_404(Tournament, pk=pk)
    if request.method == 'POST':
        ign = request.POST.get('ign_tag')
        team_name = request.POST.get('team_name', '').strip()
        rank = request.POST.get('rank')
        age = request.POST.get('age')
        country = request.POST.get('country')
        city = request.POST.get('city')
        heard = request.POST.get('heard_from')
        # Basic duplicate prevention: one application per user per tournament
        Application.objects.update_or_create(
            applicant=request.user, tournament=tournament,
            defaults={'ign_tag': ign, 'team_name': team_name, 'rank': rank, 'age': age or None, 'country': country, 'city': city, 'heard_from': heard, 'status': 'pending'}
        )
        messages.success(request, 'Application submitted.')
        return redirect('tournaments:detail', pk=pk)
    return render(request, 'tournaments/application_form.html', {'tournament': tournament})


@login_required(login_url='shop:login')
def applications_list(request):
    apps = Application.objects.select_related('tournament').all()
    return render(request, 'tournaments/applications_list.html', {'applications': apps})


@login_required(login_url='shop:login')
def application_detail(request, pk):
    app = get_object_or_404(Application, pk=pk)
    return render(request, 'tournaments/application_detail.html', {'application': app})


def match_detail(request, pk):
    match = get_object_or_404(Match, pk=pk)
    return render(request, 'tournaments/match_detail.html', {'match': match})


@login_required(login_url='shop:login')
def match_report(request, pk):
    match = get_object_or_404(Match, pk=pk)
    if request.method == 'POST':
        match.score = request.POST.get('score', '')
        match.proof = request.POST.get('proof', '')
        match.added_by = request.user
        match.save()
        # Attempt to auto-assign winner from score if format like '13-9'
        if match.team_a and match.team_b and match.score:
            m = re.search(r"(\d+)\D+(\d+)", match.score)
            if m:
                a_score = int(m.group(1))
                b_score = int(m.group(2))
                if a_score != b_score:
                    if a_score > b_score:
                        match.winner = match.team_a
                        match.loser = match.team_b
                    else:
                        match.winner = match.team_b
                        match.loser = match.team_a
                    match.save()
                    # propagate winner to next match if it's linked
                    try:
                        if match.next_match:
                            if match.next_slot == 'a':
                                if not match.next_match.team_a:
                                    match.next_match.team_a = match.winner
                            else:
                                if not match.next_match.team_b:
                                    match.next_match.team_b = match.winner
                            match.next_match.save()
                    except Exception:
                        pass
        messages.success(request, 'Match report submitted.')
        return redirect('tournaments:match_detail', pk=pk)
    return render(request, 'tournaments/match_report.html', {'match': match})
