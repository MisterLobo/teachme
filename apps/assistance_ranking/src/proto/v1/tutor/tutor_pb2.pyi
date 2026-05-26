from google.protobuf import timestamp_pb2 as _timestamp_pb2
from google.protobuf import any_pb2 as _any_pb2
from google.protobuf.internal import containers as _containers
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from collections.abc import Iterable as _Iterable, Mapping as _Mapping
from typing import ClassVar as _ClassVar, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class TutorGetById(_message.Message):
    __slots__ = ("id", "with_availability", "with_ratings")
    ID_FIELD_NUMBER: _ClassVar[int]
    WITH_AVAILABILITY_FIELD_NUMBER: _ClassVar[int]
    WITH_RATINGS_FIELD_NUMBER: _ClassVar[int]
    id: str
    with_availability: bool
    with_ratings: bool
    def __init__(self, id: _Optional[str] = ..., with_availability: _Optional[bool] = ..., with_ratings: _Optional[bool] = ...) -> None: ...

class TutorList(_message.Message):
    __slots__ = ("ids", "status")
    IDS_FIELD_NUMBER: _ClassVar[int]
    STATUS_FIELD_NUMBER: _ClassVar[int]
    ids: _containers.RepeatedScalarFieldContainer[str]
    status: _containers.RepeatedScalarFieldContainer[str]
    def __init__(self, ids: _Optional[_Iterable[str]] = ..., status: _Optional[_Iterable[str]] = ...) -> None: ...

class TutorSearch(_message.Message):
    __slots__ = ("query", "tz", "user_id", "pid")
    QUERY_FIELD_NUMBER: _ClassVar[int]
    TZ_FIELD_NUMBER: _ClassVar[int]
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    PID_FIELD_NUMBER: _ClassVar[int]
    query: str
    tz: str
    user_id: str
    pid: str
    def __init__(self, query: _Optional[str] = ..., tz: _Optional[str] = ..., user_id: _Optional[str] = ..., pid: _Optional[str] = ...) -> None: ...

class TutorSmartSearch(_message.Message):
    __slots__ = ("category", "subject", "country", "currency", "timezone", "session_duration", "budget", "start_time", "locale", "topic", "code", "availability_window", "characteristics", "skill_level")
    CATEGORY_FIELD_NUMBER: _ClassVar[int]
    SUBJECT_FIELD_NUMBER: _ClassVar[int]
    COUNTRY_FIELD_NUMBER: _ClassVar[int]
    CURRENCY_FIELD_NUMBER: _ClassVar[int]
    TIMEZONE_FIELD_NUMBER: _ClassVar[int]
    SESSION_DURATION_FIELD_NUMBER: _ClassVar[int]
    BUDGET_FIELD_NUMBER: _ClassVar[int]
    START_TIME_FIELD_NUMBER: _ClassVar[int]
    LOCALE_FIELD_NUMBER: _ClassVar[int]
    TOPIC_FIELD_NUMBER: _ClassVar[int]
    CODE_FIELD_NUMBER: _ClassVar[int]
    AVAILABILITY_WINDOW_FIELD_NUMBER: _ClassVar[int]
    CHARACTERISTICS_FIELD_NUMBER: _ClassVar[int]
    SKILL_LEVEL_FIELD_NUMBER: _ClassVar[int]
    category: str
    subject: str
    country: str
    currency: str
    timezone: str
    session_duration: int
    budget: _containers.RepeatedScalarFieldContainer[float]
    start_time: str
    locale: str
    topic: str
    code: str
    availability_window: str
    characteristics: str
    skill_level: str
    def __init__(self, category: _Optional[str] = ..., subject: _Optional[str] = ..., country: _Optional[str] = ..., currency: _Optional[str] = ..., timezone: _Optional[str] = ..., session_duration: _Optional[int] = ..., budget: _Optional[_Iterable[float]] = ..., start_time: _Optional[str] = ..., locale: _Optional[str] = ..., topic: _Optional[str] = ..., code: _Optional[str] = ..., availability_window: _Optional[str] = ..., characteristics: _Optional[str] = ..., skill_level: _Optional[str] = ...) -> None: ...

class TutorSearchResponse(_message.Message):
    __slots__ = ("category", "subject", "confidence", "currency", "timezone", "session_duration", "session_price", "start_time", "locale", "topic", "embedding")
    CATEGORY_FIELD_NUMBER: _ClassVar[int]
    SUBJECT_FIELD_NUMBER: _ClassVar[int]
    CONFIDENCE_FIELD_NUMBER: _ClassVar[int]
    CURRENCY_FIELD_NUMBER: _ClassVar[int]
    TIMEZONE_FIELD_NUMBER: _ClassVar[int]
    SESSION_DURATION_FIELD_NUMBER: _ClassVar[int]
    SESSION_PRICE_FIELD_NUMBER: _ClassVar[int]
    START_TIME_FIELD_NUMBER: _ClassVar[int]
    LOCALE_FIELD_NUMBER: _ClassVar[int]
    TOPIC_FIELD_NUMBER: _ClassVar[int]
    EMBEDDING_FIELD_NUMBER: _ClassVar[int]
    category: str
    subject: str
    confidence: float
    currency: str
    timezone: str
    session_duration: int
    session_price: float
    start_time: str
    locale: str
    topic: str
    embedding: _containers.RepeatedScalarFieldContainer[float]
    def __init__(self, category: _Optional[str] = ..., subject: _Optional[str] = ..., confidence: _Optional[float] = ..., currency: _Optional[str] = ..., timezone: _Optional[str] = ..., session_duration: _Optional[int] = ..., session_price: _Optional[float] = ..., start_time: _Optional[str] = ..., locale: _Optional[str] = ..., topic: _Optional[str] = ..., embedding: _Optional[_Iterable[float]] = ...) -> None: ...

class TutorGetAvailableSlots(_message.Message):
    __slots__ = ("query", "tz", "user_id", "pid")
    QUERY_FIELD_NUMBER: _ClassVar[int]
    TZ_FIELD_NUMBER: _ClassVar[int]
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    PID_FIELD_NUMBER: _ClassVar[int]
    query: str
    tz: str
    user_id: str
    pid: str
    def __init__(self, query: _Optional[str] = ..., tz: _Optional[str] = ..., user_id: _Optional[str] = ..., pid: _Optional[str] = ...) -> None: ...

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

class TutorDateTimeSlots(_message.Message):
    __slots__ = ("id", "slots", "profile")
    ID_FIELD_NUMBER: _ClassVar[int]
    SLOTS_FIELD_NUMBER: _ClassVar[int]
    PROFILE_FIELD_NUMBER: _ClassVar[int]
    id: str
    slots: _containers.RepeatedCompositeFieldContainer[TutorGetAvailableSlotsResponseSlots]
    profile: TutorProfileData
    def __init__(self, id: _Optional[str] = ..., slots: _Optional[_Iterable[_Union[TutorGetAvailableSlotsResponseSlots, _Mapping]]] = ..., profile: _Optional[_Union[TutorProfileData, _Mapping]] = ...) -> None: ...

class TutorTest(_message.Message):
    __slots__ = ("id",)
    ID_FIELD_NUMBER: _ClassVar[int]
    id: str
    def __init__(self, id: _Optional[str] = ...) -> None: ...

class TutorAvailableSlotsResponse(_message.Message):
    __slots__ = ("slots",)
    SLOTS_FIELD_NUMBER: _ClassVar[int]
    slots: _containers.RepeatedCompositeFieldContainer[TutorDateTimeSlots]
    def __init__(self, slots: _Optional[_Iterable[_Union[TutorDateTimeSlots, _Mapping]]] = ...) -> None: ...

class TutorGetAvailableSlotsResponseSlots(_message.Message):
    __slots__ = ("date_slot", "time_slots")
    DATE_SLOT_FIELD_NUMBER: _ClassVar[int]
    TIME_SLOTS_FIELD_NUMBER: _ClassVar[int]
    date_slot: str
    time_slots: _containers.RepeatedCompositeFieldContainer[TutorGetAvailableSlotsResponseTimeSlot]
    def __init__(self, date_slot: _Optional[str] = ..., time_slots: _Optional[_Iterable[_Union[TutorGetAvailableSlotsResponseTimeSlot, _Mapping]]] = ...) -> None: ...

class TutorGetAvailableSlotsResponseTimeSlot(_message.Message):
    __slots__ = ("start",)
    START_FIELD_NUMBER: _ClassVar[int]
    start: str
    def __init__(self, start: _Optional[str] = ...) -> None: ...

class TutorResponse(_message.Message):
    __slots__ = ("status", "inner", "outer")
    STATUS_FIELD_NUMBER: _ClassVar[int]
    INNER_FIELD_NUMBER: _ClassVar[int]
    OUTER_FIELD_NUMBER: _ClassVar[int]
    status: str
    inner: TutorSearchResponse
    outer: TutorAvailableSlotsResponse
    def __init__(self, status: _Optional[str] = ..., inner: _Optional[_Union[TutorSearchResponse, _Mapping]] = ..., outer: _Optional[_Union[TutorAvailableSlotsResponse, _Mapping]] = ...) -> None: ...

class TutorGetEmbedding(_message.Message):
    __slots__ = ("id",)
    ID_FIELD_NUMBER: _ClassVar[int]
    id: str
    def __init__(self, id: _Optional[str] = ...) -> None: ...

class TutorGetEmbeddingResponse(_message.Message):
    __slots__ = ("embedding",)
    EMBEDDING_FIELD_NUMBER: _ClassVar[int]
    embedding: _containers.RepeatedScalarFieldContainer[float]
    def __init__(self, embedding: _Optional[_Iterable[float]] = ...) -> None: ...

class TutorGetPublicKeyRequest(_message.Message):
    __slots__ = ("id",)
    ID_FIELD_NUMBER: _ClassVar[int]
    id: str
    def __init__(self, id: _Optional[str] = ...) -> None: ...

class TutorGetPublicKeyResponse(_message.Message):
    __slots__ = ("status", "status_code", "error", "public_keys")
    class TutorPublicKey(_message.Message):
        __slots__ = ("type", "key", "credential_id")
        TYPE_FIELD_NUMBER: _ClassVar[int]
        KEY_FIELD_NUMBER: _ClassVar[int]
        CREDENTIAL_ID_FIELD_NUMBER: _ClassVar[int]
        type: str
        key: bytes
        credential_id: str
        def __init__(self, type: _Optional[str] = ..., key: _Optional[bytes] = ..., credential_id: _Optional[str] = ...) -> None: ...
    STATUS_FIELD_NUMBER: _ClassVar[int]
    STATUS_CODE_FIELD_NUMBER: _ClassVar[int]
    ERROR_FIELD_NUMBER: _ClassVar[int]
    PUBLIC_KEYS_FIELD_NUMBER: _ClassVar[int]
    status: str
    status_code: int
    error: str
    public_keys: _containers.RepeatedCompositeFieldContainer[TutorGetPublicKeyResponse.TutorPublicKey]
    def __init__(self, status: _Optional[str] = ..., status_code: _Optional[int] = ..., error: _Optional[str] = ..., public_keys: _Optional[_Iterable[_Union[TutorGetPublicKeyResponse.TutorPublicKey, _Mapping]]] = ...) -> None: ...
