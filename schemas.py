"""Pydantic request and response contracts for the HTTP API."""

from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class CourseResponse(BaseModel):
    id: int
    name: str
    is_active: bool


class CourseActiveUpdate(BaseModel):
    is_active: bool


class AssignmentResponse(BaseModel):
    id: int
    title: str
    course_id: Optional[int] = None
    course_name: Optional[str] = None
    due_date: Optional[str]
    is_completed: bool
    completion_overridden: bool = False
    url: str


class VODResponse(BaseModel):
    id: int
    title: str
    course_id: Optional[int] = None
    course_name: Optional[str] = None
    start_date: Optional[str]
    end_date: Optional[str]
    is_completed: bool
    url: str


class PostResponse(BaseModel):
    id: int
    title: str
    writer: str
    date: str
    url: str
    content: Optional[str]


class BoardResponse(BaseModel):
    id: int
    title: str
    url: str


class LoginRequest(BaseModel):
    username: str
    password: str


class SessionSyncRequest(BaseModel):
    cookies: str
    user_id: Optional[int] = None


class ExtensionCookieExchangeRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')

    cookies: str = Field(min_length=1, max_length=32_768)


class ExtensionTicketCompleteRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')

    ticket: str = Field(min_length=32, max_length=512, pattern=r"^[A-Za-z0-9_-]+$")


class PushTokenRequest(BaseModel):
    token: str
    device_name: Optional[str] = None


class PreferencesRequest(BaseModel):
    new_assignment: bool = True
    new_vod: bool = True
    notice: bool = True


class ChatRequest(BaseModel):
    messages: list


class BrainChatRequest(BaseModel):
    messages: list


class ManualTranscribeRequest(BaseModel):
    media_url: Optional[str] = None


class LoginDebugReportRequest(BaseModel):
    device_info: Optional[str] = None
    logs: list


class FlashcardItem(BaseModel):
    front: str
    back: str


class GenerateFlashcardsRequest(BaseModel):
    count: int = 10


class SaveDeckRequest(BaseModel):
    name: str
    vod_moodle_id: int
    cards: List[FlashcardItem]


class AssignmentStatusUpdateRequest(BaseModel):
    is_completed: bool
    lock_override: bool = True


class LabsSettingsUpdateRequest(BaseModel):
    auto_watch_enabled: bool | None = None
    brain_enabled: bool | None = None


class CourseBrainUpdateRequest(BaseModel):
    enabled: bool | None = None
    # Which kinds of material to learn, e.g. {"vods": false}. Partial updates merge onto
    # what is stored, so the screen can send one switch without restating the others.
    scope: dict[str, bool] | None = None


class FlashcardDeckResponse(BaseModel):
    id: int
    name: str
    vod_moodle_id: int
    course_name: Optional[str]
    card_count: int
    created_at: str


class StatsResponse(BaseModel):
    total_assignments_due: int
    completed_assignments_due: int
    missed_assignments_count: int
    missed_vods_count: int


class DashboardOverviewResponse(BaseModel):
    stats: StatsResponse
    upcoming_assignments: List[AssignmentResponse]
    missed_assignments: List[AssignmentResponse]
    available_vods: List[VODResponse]
    missed_vods: List[VODResponse]
    unchecked_vods: List[VODResponse]
    upcoming_vods: List[VODResponse]
    summary: Optional[str] = None
