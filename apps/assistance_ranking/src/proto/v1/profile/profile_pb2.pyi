from google.protobuf import timestamp_pb2 as _timestamp_pb2
from google.protobuf import any_pb2 as _any_pb2
from google.protobuf.internal import containers as _containers
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from collections.abc import Iterable as _Iterable, Mapping as _Mapping
from typing import ClassVar as _ClassVar, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class ProfileGet(_message.Message):
    __slots__ = ("with_availability",)
    WITH_AVAILABILITY_FIELD_NUMBER: _ClassVar[int]
    with_availability: bool
    def __init__(self, with_availability: _Optional[bool] = ...) -> None: ...

class ProfileUpdate(_message.Message):
    __slots__ = ("country", "currency", "timezone", "title", "categories", "subjects", "primary_language", "locale", "plan", "is_trial", "first_name", "last_name", "session_duration", "session_price")
    COUNTRY_FIELD_NUMBER: _ClassVar[int]
    CURRENCY_FIELD_NUMBER: _ClassVar[int]
    TIMEZONE_FIELD_NUMBER: _ClassVar[int]
    TITLE_FIELD_NUMBER: _ClassVar[int]
    CATEGORIES_FIELD_NUMBER: _ClassVar[int]
    SUBJECTS_FIELD_NUMBER: _ClassVar[int]
    PRIMARY_LANGUAGE_FIELD_NUMBER: _ClassVar[int]
    LOCALE_FIELD_NUMBER: _ClassVar[int]
    PLAN_FIELD_NUMBER: _ClassVar[int]
    IS_TRIAL_FIELD_NUMBER: _ClassVar[int]
    FIRST_NAME_FIELD_NUMBER: _ClassVar[int]
    LAST_NAME_FIELD_NUMBER: _ClassVar[int]
    SESSION_DURATION_FIELD_NUMBER: _ClassVar[int]
    SESSION_PRICE_FIELD_NUMBER: _ClassVar[int]
    country: str
    currency: str
    timezone: str
    title: str
    categories: str
    subjects: str
    primary_language: str
    locale: str
    plan: str
    is_trial: bool
    first_name: str
    last_name: str
    session_duration: int
    session_price: float
    def __init__(self, country: _Optional[str] = ..., currency: _Optional[str] = ..., timezone: _Optional[str] = ..., title: _Optional[str] = ..., categories: _Optional[str] = ..., subjects: _Optional[str] = ..., primary_language: _Optional[str] = ..., locale: _Optional[str] = ..., plan: _Optional[str] = ..., is_trial: _Optional[bool] = ..., first_name: _Optional[str] = ..., last_name: _Optional[str] = ..., session_duration: _Optional[int] = ..., session_price: _Optional[float] = ...) -> None: ...

class ProfileData(_message.Message):
    __slots__ = ("id", "name", "first_name", "last_name", "country", "currency", "language", "dob", "session_duration", "session_price", "categories", "subjects", "title", "bio", "interests", "email", "phone", "account_verified", "payment_verified", "passkey_enabled", "average_rating", "students", "availability", "specialties", "private_sessions_enabled", "avatar_url", "banner_url")
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
    EMAIL_FIELD_NUMBER: _ClassVar[int]
    PHONE_FIELD_NUMBER: _ClassVar[int]
    ACCOUNT_VERIFIED_FIELD_NUMBER: _ClassVar[int]
    PAYMENT_VERIFIED_FIELD_NUMBER: _ClassVar[int]
    PASSKEY_ENABLED_FIELD_NUMBER: _ClassVar[int]
    AVERAGE_RATING_FIELD_NUMBER: _ClassVar[int]
    STUDENTS_FIELD_NUMBER: _ClassVar[int]
    AVAILABILITY_FIELD_NUMBER: _ClassVar[int]
    SPECIALTIES_FIELD_NUMBER: _ClassVar[int]
    PRIVATE_SESSIONS_ENABLED_FIELD_NUMBER: _ClassVar[int]
    AVATAR_URL_FIELD_NUMBER: _ClassVar[int]
    BANNER_URL_FIELD_NUMBER: _ClassVar[int]
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
    email: str
    phone: str
    account_verified: bool
    payment_verified: bool
    passkey_enabled: bool
    average_rating: float
    students: int
    availability: _containers.RepeatedScalarFieldContainer[str]
    specialties: _containers.RepeatedScalarFieldContainer[str]
    private_sessions_enabled: bool
    avatar_url: str
    banner_url: str
    def __init__(self, id: _Optional[str] = ..., name: _Optional[str] = ..., first_name: _Optional[str] = ..., last_name: _Optional[str] = ..., country: _Optional[str] = ..., currency: _Optional[str] = ..., language: _Optional[str] = ..., dob: _Optional[str] = ..., session_duration: _Optional[int] = ..., session_price: _Optional[float] = ..., categories: _Optional[str] = ..., subjects: _Optional[str] = ..., title: _Optional[str] = ..., bio: _Optional[str] = ..., interests: _Optional[str] = ..., email: _Optional[str] = ..., phone: _Optional[str] = ..., account_verified: _Optional[bool] = ..., payment_verified: _Optional[bool] = ..., passkey_enabled: _Optional[bool] = ..., average_rating: _Optional[float] = ..., students: _Optional[int] = ..., availability: _Optional[_Iterable[str]] = ..., specialties: _Optional[_Iterable[str]] = ..., private_sessions_enabled: _Optional[bool] = ..., avatar_url: _Optional[str] = ..., banner_url: _Optional[str] = ...) -> None: ...

class TutorProfile(_message.Message):
    __slots__ = ("id", "first_name", "last_name", "country", "currency", "language", "session_duration", "session_price", "categories", "subjects", "title", "bio", "other_languages", "status", "verified", "payment_verified", "phone_verified", "rating")
    ID_FIELD_NUMBER: _ClassVar[int]
    FIRST_NAME_FIELD_NUMBER: _ClassVar[int]
    LAST_NAME_FIELD_NUMBER: _ClassVar[int]
    COUNTRY_FIELD_NUMBER: _ClassVar[int]
    CURRENCY_FIELD_NUMBER: _ClassVar[int]
    LANGUAGE_FIELD_NUMBER: _ClassVar[int]
    SESSION_DURATION_FIELD_NUMBER: _ClassVar[int]
    SESSION_PRICE_FIELD_NUMBER: _ClassVar[int]
    CATEGORIES_FIELD_NUMBER: _ClassVar[int]
    SUBJECTS_FIELD_NUMBER: _ClassVar[int]
    TITLE_FIELD_NUMBER: _ClassVar[int]
    BIO_FIELD_NUMBER: _ClassVar[int]
    OTHER_LANGUAGES_FIELD_NUMBER: _ClassVar[int]
    STATUS_FIELD_NUMBER: _ClassVar[int]
    VERIFIED_FIELD_NUMBER: _ClassVar[int]
    PAYMENT_VERIFIED_FIELD_NUMBER: _ClassVar[int]
    PHONE_VERIFIED_FIELD_NUMBER: _ClassVar[int]
    RATING_FIELD_NUMBER: _ClassVar[int]
    id: str
    first_name: str
    last_name: str
    country: str
    currency: str
    language: str
    session_duration: int
    session_price: float
    categories: str
    subjects: str
    title: str
    bio: str
    other_languages: str
    status: str
    verified: bool
    payment_verified: bool
    phone_verified: bool
    rating: float
    def __init__(self, id: _Optional[str] = ..., first_name: _Optional[str] = ..., last_name: _Optional[str] = ..., country: _Optional[str] = ..., currency: _Optional[str] = ..., language: _Optional[str] = ..., session_duration: _Optional[int] = ..., session_price: _Optional[float] = ..., categories: _Optional[str] = ..., subjects: _Optional[str] = ..., title: _Optional[str] = ..., bio: _Optional[str] = ..., other_languages: _Optional[str] = ..., status: _Optional[str] = ..., verified: _Optional[bool] = ..., payment_verified: _Optional[bool] = ..., phone_verified: _Optional[bool] = ..., rating: _Optional[float] = ...) -> None: ...

class StudentProfile(_message.Message):
    __slots__ = ("id", "first_name", "last_name", "country", "currency", "language", "dob", "status")
    ID_FIELD_NUMBER: _ClassVar[int]
    FIRST_NAME_FIELD_NUMBER: _ClassVar[int]
    LAST_NAME_FIELD_NUMBER: _ClassVar[int]
    COUNTRY_FIELD_NUMBER: _ClassVar[int]
    CURRENCY_FIELD_NUMBER: _ClassVar[int]
    LANGUAGE_FIELD_NUMBER: _ClassVar[int]
    DOB_FIELD_NUMBER: _ClassVar[int]
    STATUS_FIELD_NUMBER: _ClassVar[int]
    id: str
    first_name: str
    last_name: str
    country: str
    currency: str
    language: str
    dob: str
    status: str
    def __init__(self, id: _Optional[str] = ..., first_name: _Optional[str] = ..., last_name: _Optional[str] = ..., country: _Optional[str] = ..., currency: _Optional[str] = ..., language: _Optional[str] = ..., dob: _Optional[str] = ..., status: _Optional[str] = ...) -> None: ...

class ProfileResponse(_message.Message):
    __slots__ = ("status", "status_code", "data", "error")
    STATUS_FIELD_NUMBER: _ClassVar[int]
    STATUS_CODE_FIELD_NUMBER: _ClassVar[int]
    DATA_FIELD_NUMBER: _ClassVar[int]
    ERROR_FIELD_NUMBER: _ClassVar[int]
    status: str
    status_code: int
    data: ProfileData
    error: str
    def __init__(self, status: _Optional[str] = ..., status_code: _Optional[int] = ..., data: _Optional[_Union[ProfileData, _Mapping]] = ..., error: _Optional[str] = ...) -> None: ...
