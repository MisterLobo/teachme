from google.protobuf.internal import containers as _containers
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from collections.abc import Iterable as _Iterable, Mapping as _Mapping
from typing import ClassVar as _ClassVar, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class ToolGetUserProfile(_message.Message):
    __slots__ = ("pid", "id")
    PID_FIELD_NUMBER: _ClassVar[int]
    ID_FIELD_NUMBER: _ClassVar[int]
    pid: str
    id: str
    def __init__(self, pid: _Optional[str] = ..., id: _Optional[str] = ...) -> None: ...

class ToolMatchTutors(_message.Message):
    __slots__ = ("profile",)
    PROFILE_FIELD_NUMBER: _ClassVar[int]
    profile: ToolUserProfile
    def __init__(self, profile: _Optional[_Union[ToolUserProfile, _Mapping]] = ...) -> None: ...

class ToolMatchedTutors(_message.Message):
    __slots__ = ("result",)
    RESULT_FIELD_NUMBER: _ClassVar[int]
    result: _containers.RepeatedCompositeFieldContainer[ToolGraphSearchResultsResult]
    def __init__(self, result: _Optional[_Iterable[_Union[ToolGraphSearchResultsResult, _Mapping]]] = ...) -> None: ...

class ToolUserProfile(_message.Message):
    __slots__ = ("id", "email", "name", "first_name", "last_name", "country", "currency", "language", "locale", "categories", "subjects", "characteristics", "availability", "interests", "budget")
    ID_FIELD_NUMBER: _ClassVar[int]
    EMAIL_FIELD_NUMBER: _ClassVar[int]
    NAME_FIELD_NUMBER: _ClassVar[int]
    FIRST_NAME_FIELD_NUMBER: _ClassVar[int]
    LAST_NAME_FIELD_NUMBER: _ClassVar[int]
    COUNTRY_FIELD_NUMBER: _ClassVar[int]
    CURRENCY_FIELD_NUMBER: _ClassVar[int]
    LANGUAGE_FIELD_NUMBER: _ClassVar[int]
    LOCALE_FIELD_NUMBER: _ClassVar[int]
    CATEGORIES_FIELD_NUMBER: _ClassVar[int]
    SUBJECTS_FIELD_NUMBER: _ClassVar[int]
    CHARACTERISTICS_FIELD_NUMBER: _ClassVar[int]
    AVAILABILITY_FIELD_NUMBER: _ClassVar[int]
    INTERESTS_FIELD_NUMBER: _ClassVar[int]
    BUDGET_FIELD_NUMBER: _ClassVar[int]
    id: str
    email: str
    name: str
    first_name: str
    last_name: str
    country: str
    currency: str
    language: str
    locale: str
    categories: _containers.RepeatedScalarFieldContainer[str]
    subjects: _containers.RepeatedScalarFieldContainer[str]
    characteristics: _containers.RepeatedScalarFieldContainer[str]
    availability: str
    interests: _containers.RepeatedScalarFieldContainer[str]
    budget: _containers.RepeatedScalarFieldContainer[float]
    def __init__(self, id: _Optional[str] = ..., email: _Optional[str] = ..., name: _Optional[str] = ..., first_name: _Optional[str] = ..., last_name: _Optional[str] = ..., country: _Optional[str] = ..., currency: _Optional[str] = ..., language: _Optional[str] = ..., locale: _Optional[str] = ..., categories: _Optional[_Iterable[str]] = ..., subjects: _Optional[_Iterable[str]] = ..., characteristics: _Optional[_Iterable[str]] = ..., availability: _Optional[str] = ..., interests: _Optional[_Iterable[str]] = ..., budget: _Optional[_Iterable[float]] = ...) -> None: ...

class ToolSearchIntent(_message.Message):
    __slots__ = ("start_time", "timezone", "category", "subject", "session_duration", "session_price", "currency", "confidence", "locale", "embeddings")
    START_TIME_FIELD_NUMBER: _ClassVar[int]
    TIMEZONE_FIELD_NUMBER: _ClassVar[int]
    CATEGORY_FIELD_NUMBER: _ClassVar[int]
    SUBJECT_FIELD_NUMBER: _ClassVar[int]
    SESSION_DURATION_FIELD_NUMBER: _ClassVar[int]
    SESSION_PRICE_FIELD_NUMBER: _ClassVar[int]
    CURRENCY_FIELD_NUMBER: _ClassVar[int]
    CONFIDENCE_FIELD_NUMBER: _ClassVar[int]
    LOCALE_FIELD_NUMBER: _ClassVar[int]
    EMBEDDINGS_FIELD_NUMBER: _ClassVar[int]
    start_time: str
    timezone: str
    category: str
    subject: str
    session_duration: int
    session_price: float
    currency: str
    confidence: float
    locale: str
    embeddings: _containers.RepeatedScalarFieldContainer[float]
    def __init__(self, start_time: _Optional[str] = ..., timezone: _Optional[str] = ..., category: _Optional[str] = ..., subject: _Optional[str] = ..., session_duration: _Optional[int] = ..., session_price: _Optional[float] = ..., currency: _Optional[str] = ..., confidence: _Optional[float] = ..., locale: _Optional[str] = ..., embeddings: _Optional[_Iterable[float]] = ...) -> None: ...

class ToolVectorSearch(_message.Message):
    __slots__ = ("intent", "embeddings")
    INTENT_FIELD_NUMBER: _ClassVar[int]
    EMBEDDINGS_FIELD_NUMBER: _ClassVar[int]
    intent: ToolSearchIntent
    embeddings: _containers.RepeatedScalarFieldContainer[float]
    def __init__(self, intent: _Optional[_Union[ToolSearchIntent, _Mapping]] = ..., embeddings: _Optional[_Iterable[float]] = ...) -> None: ...

class ToolVectorSearchResults(_message.Message):
    __slots__ = ("points",)
    class ToolVectorSearchResultsPayload(_message.Message):
        __slots__ = ("id", "name", "country", "title", "bio", "categories", "subjects", "currency", "session_duration", "session_price", "locale")
        ID_FIELD_NUMBER: _ClassVar[int]
        NAME_FIELD_NUMBER: _ClassVar[int]
        COUNTRY_FIELD_NUMBER: _ClassVar[int]
        TITLE_FIELD_NUMBER: _ClassVar[int]
        BIO_FIELD_NUMBER: _ClassVar[int]
        CATEGORIES_FIELD_NUMBER: _ClassVar[int]
        SUBJECTS_FIELD_NUMBER: _ClassVar[int]
        CURRENCY_FIELD_NUMBER: _ClassVar[int]
        SESSION_DURATION_FIELD_NUMBER: _ClassVar[int]
        SESSION_PRICE_FIELD_NUMBER: _ClassVar[int]
        LOCALE_FIELD_NUMBER: _ClassVar[int]
        id: str
        name: str
        country: str
        title: str
        bio: str
        categories: str
        subjects: str
        currency: str
        session_duration: int
        session_price: float
        locale: str
        def __init__(self, id: _Optional[str] = ..., name: _Optional[str] = ..., country: _Optional[str] = ..., title: _Optional[str] = ..., bio: _Optional[str] = ..., categories: _Optional[str] = ..., subjects: _Optional[str] = ..., currency: _Optional[str] = ..., session_duration: _Optional[int] = ..., session_price: _Optional[float] = ..., locale: _Optional[str] = ...) -> None: ...
    class ToolVectorSearchResultsPoints(_message.Message):
        __slots__ = ("id", "payload")
        ID_FIELD_NUMBER: _ClassVar[int]
        PAYLOAD_FIELD_NUMBER: _ClassVar[int]
        id: str
        payload: ToolVectorSearchResults.ToolVectorSearchResultsPayload
        def __init__(self, id: _Optional[str] = ..., payload: _Optional[_Union[ToolVectorSearchResults.ToolVectorSearchResultsPayload, _Mapping]] = ...) -> None: ...
    POINTS_FIELD_NUMBER: _ClassVar[int]
    points: _containers.RepeatedCompositeFieldContainer[ToolVectorSearchResults.ToolVectorSearchResultsPoints]
    def __init__(self, points: _Optional[_Iterable[_Union[ToolVectorSearchResults.ToolVectorSearchResultsPoints, _Mapping]]] = ...) -> None: ...

class ToolGraphSearch(_message.Message):
    __slots__ = ("ids",)
    IDS_FIELD_NUMBER: _ClassVar[int]
    ids: _containers.RepeatedScalarFieldContainer[str]
    def __init__(self, ids: _Optional[_Iterable[str]] = ...) -> None: ...

class ToolGraphSearchResultsResult(_message.Message):
    __slots__ = ("id", "name", "country", "title", "bio", "categories", "subjects", "currency", "session_duration", "session_price", "locale")
    ID_FIELD_NUMBER: _ClassVar[int]
    NAME_FIELD_NUMBER: _ClassVar[int]
    COUNTRY_FIELD_NUMBER: _ClassVar[int]
    TITLE_FIELD_NUMBER: _ClassVar[int]
    BIO_FIELD_NUMBER: _ClassVar[int]
    CATEGORIES_FIELD_NUMBER: _ClassVar[int]
    SUBJECTS_FIELD_NUMBER: _ClassVar[int]
    CURRENCY_FIELD_NUMBER: _ClassVar[int]
    SESSION_DURATION_FIELD_NUMBER: _ClassVar[int]
    SESSION_PRICE_FIELD_NUMBER: _ClassVar[int]
    LOCALE_FIELD_NUMBER: _ClassVar[int]
    id: str
    name: str
    country: str
    title: str
    bio: str
    categories: str
    subjects: str
    currency: str
    session_duration: int
    session_price: float
    locale: str
    def __init__(self, id: _Optional[str] = ..., name: _Optional[str] = ..., country: _Optional[str] = ..., title: _Optional[str] = ..., bio: _Optional[str] = ..., categories: _Optional[str] = ..., subjects: _Optional[str] = ..., currency: _Optional[str] = ..., session_duration: _Optional[int] = ..., session_price: _Optional[float] = ..., locale: _Optional[str] = ...) -> None: ...

class ToolGraphSearchResults(_message.Message):
    __slots__ = ("result",)
    RESULT_FIELD_NUMBER: _ClassVar[int]
    result: _containers.RepeatedCompositeFieldContainer[ToolGraphSearchResultsResult]
    def __init__(self, result: _Optional[_Iterable[_Union[ToolGraphSearchResultsResult, _Mapping]]] = ...) -> None: ...

class ToolScheduleSearch(_message.Message):
    __slots__ = ("ids", "start_time", "timezone")
    IDS_FIELD_NUMBER: _ClassVar[int]
    START_TIME_FIELD_NUMBER: _ClassVar[int]
    TIMEZONE_FIELD_NUMBER: _ClassVar[int]
    ids: _containers.RepeatedScalarFieldContainer[str]
    start_time: str
    timezone: str
    def __init__(self, ids: _Optional[_Iterable[str]] = ..., start_time: _Optional[str] = ..., timezone: _Optional[str] = ...) -> None: ...

class ToolScheduleSearchResults(_message.Message):
    __slots__ = ("results",)
    class TutorProfileData(_message.Message):
        __slots__ = ("id", "name", "first_name", "last_name", "country", "currency", "language", "dob", "session_duration", "session_price", "categories", "subjects", "title", "bio", "interests", "rating", "timezone")
        ID_FIELD_NUMBER: _ClassVar[int]
        NAME_FIELD_NUMBER: _ClassVar[int]
        FIRST_NAME_FIELD_NUMBER: _ClassVar[int]
        LAST_NAME_FIELD_NUMBER: _ClassVar[int]
        COUNTRY_FIELD_NUMBER: _ClassVar[int]
        CURRENCY_FIELD_NUMBER: _ClassVar[int]
        LANGUAGE_FIELD_NUMBER: _ClassVar[int]
        DOB_FIELD_NUMBER: _ClassVar[int]
        SESSION_DURATION_FIELD_NUMBER: _ClassVar[int]
        SESSION_PRICE_FIELD_NUMBER: _ClassVar[int]
        CATEGORIES_FIELD_NUMBER: _ClassVar[int]
        SUBJECTS_FIELD_NUMBER: _ClassVar[int]
        TITLE_FIELD_NUMBER: _ClassVar[int]
        BIO_FIELD_NUMBER: _ClassVar[int]
        INTERESTS_FIELD_NUMBER: _ClassVar[int]
        RATING_FIELD_NUMBER: _ClassVar[int]
        TIMEZONE_FIELD_NUMBER: _ClassVar[int]
        id: str
        name: str
        first_name: str
        last_name: str
        country: str
        currency: str
        language: str
        dob: str
        session_duration: int
        session_price: float
        categories: str
        subjects: str
        title: str
        bio: str
        interests: str
        rating: float
        timezone: str
        def __init__(self, id: _Optional[str] = ..., name: _Optional[str] = ..., first_name: _Optional[str] = ..., last_name: _Optional[str] = ..., country: _Optional[str] = ..., currency: _Optional[str] = ..., language: _Optional[str] = ..., dob: _Optional[str] = ..., session_duration: _Optional[int] = ..., session_price: _Optional[float] = ..., categories: _Optional[str] = ..., subjects: _Optional[str] = ..., title: _Optional[str] = ..., bio: _Optional[str] = ..., interests: _Optional[str] = ..., rating: _Optional[float] = ..., timezone: _Optional[str] = ...) -> None: ...
    class ToolScheduleSearchResultsSlots(_message.Message):
        __slots__ = ("date_slot", "time_slots")
        class ToolScheduleSearchResultsSlotsTimeSlot(_message.Message):
            __slots__ = ("start",)
            START_FIELD_NUMBER: _ClassVar[int]
            start: str
            def __init__(self, start: _Optional[str] = ...) -> None: ...
        DATE_SLOT_FIELD_NUMBER: _ClassVar[int]
        TIME_SLOTS_FIELD_NUMBER: _ClassVar[int]
        date_slot: str
        time_slots: _containers.RepeatedCompositeFieldContainer[ToolScheduleSearchResults.ToolScheduleSearchResultsSlots.ToolScheduleSearchResultsSlotsTimeSlot]
        def __init__(self, date_slot: _Optional[str] = ..., time_slots: _Optional[_Iterable[_Union[ToolScheduleSearchResults.ToolScheduleSearchResultsSlots.ToolScheduleSearchResultsSlotsTimeSlot, _Mapping]]] = ...) -> None: ...
    class Result(_message.Message):
        __slots__ = ("id", "profile", "slots")
        ID_FIELD_NUMBER: _ClassVar[int]
        PROFILE_FIELD_NUMBER: _ClassVar[int]
        SLOTS_FIELD_NUMBER: _ClassVar[int]
        id: str
        profile: ToolScheduleSearchResults.TutorProfileData
        slots: _containers.RepeatedCompositeFieldContainer[ToolScheduleSearchResults.ToolScheduleSearchResultsSlots]
        def __init__(self, id: _Optional[str] = ..., profile: _Optional[_Union[ToolScheduleSearchResults.TutorProfileData, _Mapping]] = ..., slots: _Optional[_Iterable[_Union[ToolScheduleSearchResults.ToolScheduleSearchResultsSlots, _Mapping]]] = ...) -> None: ...
    RESULTS_FIELD_NUMBER: _ClassVar[int]
    results: _containers.RepeatedCompositeFieldContainer[ToolScheduleSearchResults.Result]
    def __init__(self, results: _Optional[_Iterable[_Union[ToolScheduleSearchResults.Result, _Mapping]]] = ...) -> None: ...

class ToolQuerySuggestions(_message.Message):
    __slots__ = ("user_id", "pid", "suggestions")
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    PID_FIELD_NUMBER: _ClassVar[int]
    SUGGESTIONS_FIELD_NUMBER: _ClassVar[int]
    user_id: str
    pid: str
    suggestions: _containers.RepeatedScalarFieldContainer[str]
    def __init__(self, user_id: _Optional[str] = ..., pid: _Optional[str] = ..., suggestions: _Optional[_Iterable[str]] = ...) -> None: ...

class ToolSearchResultsResponse(_message.Message):
    __slots__ = ("status", "statusCode", "vector_results", "graph_results", "schedule_results", "user_profile", "matched_tutors")
    STATUS_FIELD_NUMBER: _ClassVar[int]
    STATUSCODE_FIELD_NUMBER: _ClassVar[int]
    VECTOR_RESULTS_FIELD_NUMBER: _ClassVar[int]
    GRAPH_RESULTS_FIELD_NUMBER: _ClassVar[int]
    SCHEDULE_RESULTS_FIELD_NUMBER: _ClassVar[int]
    USER_PROFILE_FIELD_NUMBER: _ClassVar[int]
    MATCHED_TUTORS_FIELD_NUMBER: _ClassVar[int]
    status: str
    statusCode: int
    vector_results: ToolVectorSearchResults
    graph_results: ToolGraphSearchResults
    schedule_results: ToolScheduleSearchResults
    user_profile: ToolUserProfile
    matched_tutors: ToolMatchedTutors
    def __init__(self, status: _Optional[str] = ..., statusCode: _Optional[int] = ..., vector_results: _Optional[_Union[ToolVectorSearchResults, _Mapping]] = ..., graph_results: _Optional[_Union[ToolGraphSearchResults, _Mapping]] = ..., schedule_results: _Optional[_Union[ToolScheduleSearchResults, _Mapping]] = ..., user_profile: _Optional[_Union[ToolUserProfile, _Mapping]] = ..., matched_tutors: _Optional[_Union[ToolMatchedTutors, _Mapping]] = ...) -> None: ...
