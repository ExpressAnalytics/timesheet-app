from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.core.security import get_current_user
from app.db import queries

router = APIRouter(prefix="/notifications", tags=["Notifications"])


def require_admin(current_user: dict):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")


@router.get("/settings")
async def get_settings(current_user: dict = Depends(get_current_user)):
    require_admin(current_user)
    return queries.get_notification_settings()


VALID_DAYS = {"mon", "tue", "wed", "thu", "fri", "sat", "sun"}

class NotificationSettingsBody(BaseModel):
    morning_time: str
    evening_time: str
    enabled: bool = True
    weekly_day: str = "mon"
    weekly_time: str = "09:00"


@router.put("/settings")
async def update_settings(body: NotificationSettingsBody, current_user: dict = Depends(get_current_user)):
    require_admin(current_user)
    for t in (body.morning_time, body.evening_time, body.weekly_time):
        parts = t.split(":")
        if len(parts) != 2 or not all(p.isdigit() for p in parts):
            raise HTTPException(status_code=400, detail=f"Invalid time format: {t}. Use HH:MM")
        if not (0 <= int(parts[0]) <= 23 and 0 <= int(parts[1]) <= 59):
            raise HTTPException(status_code=400, detail=f"Time out of range: {t}")
    if body.weekly_day not in VALID_DAYS:
        raise HTTPException(status_code=400, detail=f"Invalid day: {body.weekly_day}")

    queries.save_notification_settings(
        body.morning_time, body.evening_time, body.enabled,
        body.weekly_day, body.weekly_time,
    )

    from app.services.scheduler_service import reschedule, reschedule_weekly
    reschedule(body.morning_time, body.evening_time)
    reschedule_weekly(body.weekly_day, body.weekly_time)

    return {
        "status": "saved",
        "morning_time": body.morning_time,
        "evening_time": body.evening_time,
        "weekly_day": body.weekly_day,
        "weekly_time": body.weekly_time,
    }


@router.post("/trigger")
async def manual_trigger(current_user: dict = Depends(get_current_user)):
    """Admin: fire the daily reminder + weekly summary immediately."""
    require_admin(current_user)
    from app.services.scheduler_service import run_morning_job, run_evening_job, run_weekly_summary_job
    reminder = {"morning": run_morning_job(), "evening": run_evening_job()}
    try:
        weekly = run_weekly_summary_job()
    except Exception as e:
        weekly = {"status": "failed", "error": str(e)}
    return {"reminder": reminder, "weekly": weekly}


@router.post("/trigger/weekly")
async def manual_weekly_trigger(current_user: dict = Depends(get_current_user)):
    """Admin: fire the weekly summary job immediately."""
    require_admin(current_user)
    from app.services.scheduler_service import run_weekly_summary_job
    result = run_weekly_summary_job()
    return result


@router.post("/test/chat")
async def test_chat_dm(current_user: dict = Depends(get_current_user)):
    """Admin: test Chat DM to own account and return detailed error info."""
    require_admin(current_user)
    import traceback
    from app.services.chat_service import _get_chat_service, _dm_space_name

    result = {"service_built": False, "space_name": None, "message_sent": False, "error": None}
    try:
        svc = _get_chat_service()
        if not svc:
            result["error"] = "Service account not found — check GOOGLE_SERVICE_ACCOUNT_CONTENT or service-account.json"
            return result
        result["service_built"] = True

        space = svc.spaces().setup(body={
            "space": {"spaceType": "DIRECT_MESSAGE"},
            "memberships": [{"member": {"name": f"users/{current_user['email']}", "type": "HUMAN"}}],
        }).execute()
        result["space_name"] = space.get("name")

        svc.spaces().messages().create(
            parent=space["name"],
            body={"text": "✅ TimeSync Chat test message — it works!"},
        ).execute()
        result["message_sent"] = True
    except Exception as e:
        result["error"] = f"{type(e).__name__}: {e}"
        result["traceback"] = traceback.format_exc()
    return result
