from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime, timezone, timedelta
import pytz
from app.core.security import get_current_user
from app.db import queries

_IST = pytz.timezone("Asia/Kolkata")


def _add_working_days(d: date, n: int, direction: int) -> date:
    count = 0
    while count < n:
        d += timedelta(days=direction)
        if d.weekday() < 5:
            count += 1
    return d

router = APIRouter(prefix="/users", tags=["Users"])


def require_admin(current_user: dict):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")


@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    user = queries.get_user_by_id(current_user["sub"])
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return dict(user)


@router.get("/all")
async def get_all_users(current_user: dict = Depends(get_current_user)):
    """Admin only — all users with manager name and resource count."""
    require_admin(current_user)
    return {"users": [dict(u) for u in queries.get_all_users_with_details()]}


@router.get("/active")
async def get_active_users(current_user: dict = Depends(get_current_user)):
    """Any authenticated user — minimal list of active users for dropdowns."""
    rows = queries.get_all_users()
    return {"users": [dict(u) for u in rows]}


@router.get("/subordinates")
async def get_subordinates(current_user: dict = Depends(get_current_user)):
    """Return direct reports for current user (teamlead/admin)."""
    if current_user.get("role") not in ("teamlead", "admin"):
        raise HTTPException(status_code=403, detail="Teamlead or Admin access required")
    subs = queries.get_subordinates(current_user["sub"])
    return {"subordinates": [dict(s) for s in subs]}


class CreateUserBody(BaseModel):
    email: str
    full_name: str
    role: str = "resource"
    manager_id: Optional[str] = None


@router.post("", status_code=201)
async def create_user(body: CreateUserBody, current_user: dict = Depends(get_current_user)):
    """Admin: create a new user account."""
    require_admin(current_user)
    if body.role not in ("admin", "teamlead", "resource"):
        raise HTTPException(status_code=400, detail="role must be admin, teamlead, or resource")
    existing = queries.find_user_by_email(body.email)
    if existing:
        raise HTTPException(status_code=409, detail="A user with this email already exists")
    new_user = queries.create_user(body.email, body.full_name, body.role)
    if not new_user:
        raise HTTPException(status_code=500, detail="Failed to create user")
    user_id = dict(new_user)["user_id"]
    if body.manager_id:
        queries.update_user_role_and_manager(user_id, body.role, body.manager_id)
        queries.bust("subs:")
    return dict(queries.get_user_by_id(user_id))


class AssignBody(BaseModel):
    user_id: str
    role: str
    manager_id: Optional[str] = None


@router.put("/assign")
async def assign_user(body: AssignBody, current_user: dict = Depends(get_current_user)):
    """Admin: update a user's role and/or manager."""
    require_admin(current_user)
    if body.role not in ("admin", "teamlead", "resource"):
        raise HTTPException(status_code=400, detail="role must be admin, teamlead, or resource")
    if body.role != "admin" and not body.manager_id:
        raise HTTPException(status_code=400, detail="manager_id required for teamlead and resource")
    queries.update_user_role_and_manager(body.user_id, body.role, body.manager_id)
    queries.bust("subs:")
    return {"status": "updated"}


@router.put("/{resource_id}/unassign")
async def unassign_resource(resource_id: str, current_user: dict = Depends(get_current_user)):
    """Admin: immediately remove a resource from their current manager."""
    require_admin(current_user)
    queries.set_users_manager([resource_id], None)
    queries.bust("subs:")
    return {"status": "unassigned"}


class GoogleAuthToggleBody(BaseModel):
    enabled: bool


@router.patch("/{user_id}/google-auth")
async def toggle_google_auth(
    user_id: str,
    body: GoogleAuthToggleBody,
    current_user: dict = Depends(get_current_user),
):
    """Admin only: enable/disable Google auth for a user. Admin cannot toggle their own account."""
    require_admin(current_user)
    if user_id == current_user["sub"]:
        raise HTTPException(status_code=400, detail="You cannot change your own Google auth setting")
    queries.toggle_google_auth(user_id, body.enabled)
    return {"user_id": user_id, "google_auth_enabled": body.enabled}


@router.patch("/{user_id}/email-notifications")
async def toggle_email_notifications(
    user_id: str,
    body: GoogleAuthToggleBody,
    current_user: dict = Depends(get_current_user),
):
    """Admin only: enable/disable email notifications for a user."""
    require_admin(current_user)
    queries.toggle_email_notifications(user_id, body.enabled)
    return {"user_id": user_id, "email_notifications_enabled": body.enabled}


@router.patch("/email-notifications/all")
async def toggle_all_email_notifications(
    body: GoogleAuthToggleBody,
    current_user: dict = Depends(get_current_user),
):
    """Admin only: enable/disable email notifications for ALL active users at once."""
    require_admin(current_user)
    queries.toggle_all_email_notifications(body.enabled)
    return {"email_notifications_enabled": body.enabled}


class JiraTokenBody(BaseModel):
    jira_token: str
    jira_token_expires_at: Optional[str] = None  # YYYY-MM-DD or None


@router.get("/me/jira-token")
async def get_my_jira_token(current_user: dict = Depends(get_current_user)):
    """Return masked token info for the current user."""
    row = queries.get_user_jira_token(current_user["sub"])
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    d = dict(row)
    token = d.get("jira_token") or ""
    masked = ("••••••••••••" + token[-4:]) if len(token) > 4 else ("••••" if token else "")
    return {
        "has_token": bool(token),
        "masked_token": masked,
        "jira_token_expires_at": str(d["jira_token_expires_at"]) if d.get("jira_token_expires_at") else None,
    }


@router.patch("/me/jira-token")
async def save_my_jira_token(body: JiraTokenBody, current_user: dict = Depends(get_current_user)):
    """Any user can save/update their own JIRA API token."""
    if not body.jira_token.strip():
        raise HTTPException(status_code=400, detail="Token cannot be empty")
    queries.save_user_jira_token(current_user["sub"], body.jira_token.strip(), body.jira_token_expires_at or None)
    return {"status": "saved"}


@router.delete("/me/jira-token", status_code=204)
async def delete_my_jira_token(current_user: dict = Depends(get_current_user)):
    """Remove the stored JIRA token."""
    queries.save_user_jira_token(current_user["sub"], None, None)


class ConfigureUserBody(BaseModel):
    role: str
    manager_id: Optional[str] = None
    resource_ids: List[str] = []   # users to place under this user (teamlead only)


class CalendarAccessBody(BaseModel):
    enabled: bool


@router.get("/me/calendar-access")
async def get_my_calendar_access(current_user: dict = Depends(get_current_user)):
    """Return current user's calendar access status and computed date range."""
    user_record = queries.get_user_by_id(current_user["sub"])
    if not user_record:
        raise HTTPException(status_code=404, detail="User not found")

    enabled  = bool(user_record.get("calendar_access_enabled"))
    expires  = user_record.get("calendar_access_expires_at")
    now_utc  = datetime.now(timezone.utc)

    if enabled and expires:
        exp_dt = expires if getattr(expires, "tzinfo", None) else expires.replace(tzinfo=timezone.utc)
        if exp_dt <= now_utc:
            queries.set_calendar_access(current_user["sub"], False, None)
            return {"enabled": False, "expires_at": None, "expires_at_ist": None,
                    "min_date": None, "max_date": None}

        today    = date.today()
        min_date = _add_working_days(today, 15, -1)
        max_date = _add_working_days(today, 10, 1)
        exp_ist  = exp_dt.astimezone(_IST)
        return {
            "enabled":        True,
            "expires_at":     exp_dt.isoformat(),
            "expires_at_ist": exp_ist.strftime("%a, %d %b %Y at %I:%M %p IST"),
            "min_date":       str(min_date),
            "max_date":       str(max_date),
        }

    return {"enabled": False, "expires_at": None, "expires_at_ist": None,
            "min_date": None, "max_date": None}


@router.patch("/{user_id}/calendar-access")
async def toggle_calendar_access(
    user_id: str,
    body: CalendarAccessBody,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
):
    """Admin only: grant (24 h) or immediately revoke extended calendar access."""
    require_admin(current_user)

    if not body.enabled:
        queries.set_calendar_access(user_id, False, None)
        return {"user_id": user_id, "calendar_access_enabled": False,
                "calendar_access_expires_at": None}

    now_utc    = datetime.now(timezone.utc)
    expires_at = now_utc + timedelta(hours=24)

    queries.set_calendar_access(user_id, True, expires_at)

    today      = date.today()
    start_date = _add_working_days(today, 15, -1)
    end_date   = _add_working_days(today, 10,  1)
    exp_ist    = expires_at.astimezone(_IST)
    expires_str = exp_ist.strftime("%a, %d %b %Y at %I:%M %p IST")

    user_record = queries.get_user_by_id(user_id)
    if user_record:
        from app.services.chat_service import send_calendar_access_dm
        background_tasks.add_task(
            send_calendar_access_dm,
            user_email    = user_record["email"],
            name          = user_record["full_name"],
            start_date    = str(start_date),
            end_date      = str(end_date),
            expires_at_str = expires_str,
        )

    return {
        "user_id":                    user_id,
        "calendar_access_enabled":    True,
        "calendar_access_expires_at": expires_at.isoformat(),
        "start_date":                 str(start_date),
        "end_date":                   str(end_date),
        "expires_at_ist":             expires_str,
    }


@router.put("/{user_id}/configure")
async def configure_user(
    user_id: str,
    body: ConfigureUserBody,
    current_user: dict = Depends(get_current_user),
):
    """Admin: set role + manager for a user, and optionally assign resources under a teamlead."""
    require_admin(current_user)
    if body.role not in ("admin", "teamlead", "resource"):
        raise HTTPException(status_code=400, detail="Invalid role")

    # 1. Update this user's own role and manager
    queries.update_user_role_and_manager(user_id, body.role, body.manager_id or None)

    # 2. Handle subordinate assignments
    if body.role in ("teamlead", "admin"):
        # Both teamleads and admins can manage resources
        current_subs = {s["user_id"] for s in queries.get_subordinates(user_id)}
        new_subs = set(body.resource_ids)
        to_unassign = list(current_subs - new_subs)
        to_assign   = list(new_subs - current_subs)
        if to_unassign:
            queries.set_users_manager(to_unassign, None)
        if to_assign:
            queries.set_users_manager(to_assign, user_id)
    else:
        # If changing away from teamlead/admin, release all their current resources
        current_subs = [s["user_id"] for s in queries.get_subordinates(user_id)]
        if current_subs:
            queries.set_users_manager(current_subs, None)

    queries.bust("subs:")
    queries.bust("pending:")
    return {"status": "configured"}
