from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.models import AuthUser
from app.routes.auth import get_current_user
from app.services.learning_service import learning_service
from app.config import settings

router = APIRouter()


class ProfileBody(BaseModel):
    exam_date: Optional[str] = None
    target_grade: str = "A1"
    daily_minutes: int = Field(default=45, ge=15, le=240)
    subjects: list[str] = []


class MasteryBody(BaseModel):
    subject: str
    topic: str
    correct: int = Field(ge=0)
    total: int = Field(ge=1, le=500)


class MockBody(BaseModel):
    subject: str
    topic: str = "Full mock"
    exam_type: str = "WASSCE"
    total_questions: int = Field(ge=1, le=200)
    correct_answers: int = Field(ge=0)
    duration_minutes: int = Field(ge=1, le=360)


class FeedbackBody(BaseModel):
    feature: str
    reference_id: Optional[str] = None
    rating: str
    details: Optional[str] = None


class ReportBody(BaseModel):
    reason: str = Field(min_length=3, max_length=300)

class ReviewCardsBody(BaseModel):
    subject: str = "Source Studio"
    cards: list[dict]

class ReviewGradeBody(BaseModel):
    rating: str

class ClassBody(BaseModel):
    name: str = Field(min_length=2, max_length=120)

class JoinClassBody(BaseModel):
    join_code: str = Field(min_length=6, max_length=20)

class AssignmentBody(BaseModel):
    title: str = Field(min_length=2, max_length=160)
    subject: str = Field(min_length=2, max_length=100)
    instructions: str = Field(default="", max_length=2000)
    due_at: Optional[str] = None

class AppealBody(BaseModel):
    event_type: str = Field(min_length=2, max_length=80)
    details: str = Field(min_length=10, max_length=2000)

class PushBody(BaseModel):
    endpoint: str
    keys: dict[str, str]

class PushMessageBody(BaseModel):
    title: str = Field(max_length=120)
    body: str = Field(max_length=500)
    url: str = "/dashboard"


@router.get("/overview")
async def overview(user: AuthUser = Depends(get_current_user)):
    mastery = learning_service.mastery(user.id)
    return {"profile": learning_service.profile(user.id), "mastery": mastery, "plan": learning_service.plan(user.id), "due_reviews": learning_service.due_review_cards(user.id), "classes": learning_service.classes_and_assignments(user.id)}


@router.put("/profile")
async def save_profile(body: ProfileBody, user: AuthUser = Depends(get_current_user)):
    return learning_service.save_profile(user.id, body.model_dump())


@router.post("/mastery")
async def record_mastery(body: MasteryBody, user: AuthUser = Depends(get_current_user)):
    return learning_service.record_mastery(user.id, body.subject.strip(), body.topic.strip(), body.correct, body.total)


@router.post("/diagnostic")
async def diagnostic(items: list[MasteryBody], user: AuthUser = Depends(get_current_user)):
    if not items or len(items) > 50: raise HTTPException(status_code=400, detail="Submit 1 to 50 diagnostic topic results.")
    results = [learning_service.record_mastery(user.id, item.subject.strip(), item.topic.strip(), item.correct, item.total) for item in items]
    return {"results": results, "recommendations": sorted(results, key=lambda item: item["mastery_score"])[:5]}


@router.post("/plan/generate")
async def generate_plan(user: AuthUser = Depends(get_current_user)):
    return learning_service.generate_plan(user.id)


@router.put("/plan/{item_id}/complete")
async def complete_plan(item_id: int, user: AuthUser = Depends(get_current_user)):
    if not learning_service.complete_plan_item(user.id, item_id): raise HTTPException(status_code=404, detail="Plan item not found.")
    return {"status": "success"}


@router.post("/mock/complete")
async def complete_mock(body: MockBody, user: AuthUser = Depends(get_current_user)):
    return learning_service.save_mock(user.id, body.model_dump())


@router.get("/offline-pack")
async def offline_pack(user: AuthUser = Depends(get_current_user)):
    return {"generated_at": learning_service.now(), "profile": learning_service.profile(user.id), "mastery": learning_service.mastery(user.id), "plan": learning_service.plan(user.id), "review_cards": learning_service.due_review_cards(user.id, 100), "classes": learning_service.classes_and_assignments(user.id), "instructions": "This pack contains your plan, due flashcards, assignments, and mastery data for low-data revision. Completed work synchronizes when you reconnect."}

@router.post("/reviews/cards")
async def save_review_cards(body: ReviewCardsBody, user: AuthUser = Depends(get_current_user)):
    if not body.cards or len(body.cards) > 100: raise HTTPException(status_code=400, detail="Submit 1 to 100 cards.")
    return learning_service.save_review_cards(user.id, body.subject, body.cards)

@router.get("/reviews/due")
async def due_review_cards(user: AuthUser = Depends(get_current_user)):
    return learning_service.due_review_cards(user.id)

@router.put("/reviews/{card_id}/grade")
async def grade_review(card_id: int, body: ReviewGradeBody, user: AuthUser = Depends(get_current_user)):
    result = learning_service.grade_review_card(user.id, card_id, body.rating)
    if not result: raise HTTPException(status_code=400, detail="Card or rating not found.")
    return result

@router.post("/classes/join")
async def join_class(body: JoinClassBody, user: AuthUser = Depends(get_current_user)):
    result = learning_service.join_class(user.id, body.join_code)
    if not result: raise HTTPException(status_code=404, detail="Class code not found.")
    return result

@router.get("/classes")
async def list_classes(user: AuthUser = Depends(get_current_user)):
    return learning_service.classes_and_assignments(user.id)

@router.post("/moderation/appeals")
async def moderation_appeal(body: AppealBody, user: AuthUser = Depends(get_current_user)):
    with learning_service.db._connect() as conn:
        learning_service.db._execute(conn, "INSERT INTO moderation_appeals (user_id,event_type,details,status,created_at) VALUES (?,?,?,'pending',?)", (user.id, body.event_type, body.details, learning_service.now()))
    return {"status": "submitted"}

@router.get("/push/config")
async def push_config():
    return {"enabled": bool(settings.VAPID_PUBLIC_KEY and settings.VAPID_PRIVATE_KEY), "public_key": settings.VAPID_PUBLIC_KEY}

@router.post("/push/subscribe")
async def push_subscribe(body: PushBody, user: AuthUser = Depends(get_current_user)):
    if not body.keys.get("p256dh") or not body.keys.get("auth"): raise HTTPException(status_code=400, detail="Invalid push subscription.")
    learning_service.save_push_subscription(user.id, body.model_dump())
    return {"status": "subscribed"}

@router.post("/push/send")
async def push_send(body: PushMessageBody, user: AuthUser = Depends(get_current_user)):
    if not user.is_admin: raise HTTPException(status_code=403, detail="Administrator access required.")
    if not settings.VAPID_PUBLIC_KEY or not settings.VAPID_PRIVATE_KEY: raise HTTPException(status_code=503, detail="Configure VAPID keys before remote push delivery.")
    import json
    from pywebpush import webpush, WebPushException
    sent = failed = 0
    with learning_service.db._connect() as conn:
        rows = learning_service.db._execute(conn, "SELECT endpoint,p256dh,auth FROM push_subscriptions").fetchall()
    for row in rows:
        try:
            webpush(subscription_info={"endpoint": row["endpoint"], "keys": {"p256dh": row["p256dh"], "auth": row["auth"]}}, data=json.dumps(body.model_dump()), vapid_private_key=settings.VAPID_PRIVATE_KEY, vapid_claims={"sub": f"mailto:{settings.VAPID_CONTACT_EMAIL}"})
            sent += 1
        except WebPushException:
            failed += 1
    return {"sent": sent, "failed": failed}


@router.post("/feedback")
async def feedback(body: FeedbackBody, user: AuthUser = Depends(get_current_user)):
    with learning_service.db._connect() as conn:
        learning_service.db._execute(conn, "INSERT INTO learning_feedback (user_id, feature, reference_id, rating, details, created_at) VALUES (?, ?, ?, ?, ?, ?)", (user.id, body.feature[:80], body.reference_id, body.rating[:30], body.details, learning_service.now()))
    return {"status": "received"}


@router.post("/community/posts/{post_id}/report")
async def report_post(post_id: int, body: ReportBody, user: AuthUser = Depends(get_current_user)):
    learning_service.report_post(user.id, post_id, body.reason)
    return {"status": "reported"}


@router.post("/community/users/{blocked_id}/block")
async def block_user(blocked_id: int, user: AuthUser = Depends(get_current_user)):
    learning_service.block_user(user.id, blocked_id)
    return {"status": "blocked"}


@router.get("/teacher/snapshot")
async def teacher_snapshot(user: AuthUser = Depends(get_current_user)):
    if not user.is_admin: raise HTTPException(status_code=403, detail="Teacher or administrator access required.")
    return learning_service.teacher_snapshot(user.id)

@router.post("/teacher/classes")
async def create_class(body: ClassBody, user: AuthUser = Depends(get_current_user)):
    if not user.is_admin: raise HTTPException(status_code=403, detail="Teacher or administrator access required.")
    return learning_service.create_class(user.id, body.name)

@router.get("/teacher/classes")
async def teacher_classes(user: AuthUser = Depends(get_current_user)):
    if not user.is_admin: raise HTTPException(status_code=403, detail="Teacher or administrator access required.")
    return learning_service.classes_and_assignments(user.id, True)

@router.post("/teacher/classes/{class_id}/assignments")
async def create_assignment(class_id: int, body: AssignmentBody, user: AuthUser = Depends(get_current_user)):
    if not user.is_admin: raise HTTPException(status_code=403, detail="Teacher or administrator access required.")
    result = learning_service.create_assignment(user.id, class_id, body.model_dump())
    if not result: raise HTTPException(status_code=404, detail="Class not found.")
    return result

@router.get("/moderation/reports")
async def moderation_reports(user: AuthUser = Depends(get_current_user)):
    if not user.is_admin: raise HTTPException(status_code=403, detail="Administrator access required.")
    return learning_service.moderation_reports()

@router.put("/moderation/reports/{report_id}")
async def resolve_report(report_id: int, body: ReviewGradeBody, user: AuthUser = Depends(get_current_user)):
    if not user.is_admin: raise HTTPException(status_code=403, detail="Administrator access required.")
    if body.rating not in {"resolved", "dismissed"}: raise HTTPException(status_code=400, detail="Use resolved or dismissed.")
    if not learning_service.resolve_report(report_id, body.rating): raise HTTPException(status_code=404, detail="Report not found.")
    return {"status": body.rating}
