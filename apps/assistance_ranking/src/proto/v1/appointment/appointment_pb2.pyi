from google.protobuf import timestamp_pb2 as _timestamp_pb2
from google.protobuf import any_pb2 as _any_pb2
from google.protobuf.internal import containers as _containers
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from collections.abc import Iterable as _Iterable, Mapping as _Mapping
from typing import ClassVar as _ClassVar, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class AppointmentRetrieve(_message.Message):
    __slots__ = ("id",)
    ID_FIELD_NUMBER: _ClassVar[int]
    id: str
    def __init__(self, id: _Optional[str] = ...) -> None: ...

class AppointmentRetrieveResponse(_message.Message):
    __slots__ = ("id", "host_id", "attendee_id", "date_time", "duration", "title", "description")
    ID_FIELD_NUMBER: _ClassVar[int]
    HOST_ID_FIELD_NUMBER: _ClassVar[int]
    ATTENDEE_ID_FIELD_NUMBER: _ClassVar[int]
    DATE_TIME_FIELD_NUMBER: _ClassVar[int]
    DURATION_FIELD_NUMBER: _ClassVar[int]
    TITLE_FIELD_NUMBER: _ClassVar[int]
    DESCRIPTION_FIELD_NUMBER: _ClassVar[int]
    id: str
    host_id: str
    attendee_id: str
    date_time: str
    duration: int
    title: str
    description: str
    def __init__(self, id: _Optional[str] = ..., host_id: _Optional[str] = ..., attendee_id: _Optional[str] = ..., date_time: _Optional[str] = ..., duration: _Optional[int] = ..., title: _Optional[str] = ..., description: _Optional[str] = ...) -> None: ...

class AppointmentList(_message.Message):
    __slots__ = ("start_date", "end_date", "duration")
    START_DATE_FIELD_NUMBER: _ClassVar[int]
    END_DATE_FIELD_NUMBER: _ClassVar[int]
    DURATION_FIELD_NUMBER: _ClassVar[int]
    start_date: str
    end_date: str
    duration: int
    def __init__(self, start_date: _Optional[str] = ..., end_date: _Optional[str] = ..., duration: _Optional[int] = ...) -> None: ...

class AppointmentListResponse(_message.Message):
    __slots__ = ("past", "upcoming")
    PAST_FIELD_NUMBER: _ClassVar[int]
    UPCOMING_FIELD_NUMBER: _ClassVar[int]
    past: _containers.RepeatedCompositeFieldContainer[AppointmentListEntry]
    upcoming: _containers.RepeatedCompositeFieldContainer[AppointmentListEntry]
    def __init__(self, past: _Optional[_Iterable[_Union[AppointmentListEntry, _Mapping]]] = ..., upcoming: _Optional[_Iterable[_Union[AppointmentListEntry, _Mapping]]] = ...) -> None: ...

class AppointmentListEntry(_message.Message):
    __slots__ = ("id", "host_id", "attendee_id", "date_time", "status", "title", "access_code")
    ID_FIELD_NUMBER: _ClassVar[int]
    HOST_ID_FIELD_NUMBER: _ClassVar[int]
    ATTENDEE_ID_FIELD_NUMBER: _ClassVar[int]
    DATE_TIME_FIELD_NUMBER: _ClassVar[int]
    STATUS_FIELD_NUMBER: _ClassVar[int]
    TITLE_FIELD_NUMBER: _ClassVar[int]
    ACCESS_CODE_FIELD_NUMBER: _ClassVar[int]
    id: str
    host_id: str
    attendee_id: str
    date_time: str
    status: str
    title: str
    access_code: bytes
    def __init__(self, id: _Optional[str] = ..., host_id: _Optional[str] = ..., attendee_id: _Optional[str] = ..., date_time: _Optional[str] = ..., status: _Optional[str] = ..., title: _Optional[str] = ..., access_code: _Optional[bytes] = ...) -> None: ...

class AppointmentResponse(_message.Message):
    __slots__ = ("status", "status_code", "list", "one", "error")
    STATUS_FIELD_NUMBER: _ClassVar[int]
    STATUS_CODE_FIELD_NUMBER: _ClassVar[int]
    LIST_FIELD_NUMBER: _ClassVar[int]
    ONE_FIELD_NUMBER: _ClassVar[int]
    ERROR_FIELD_NUMBER: _ClassVar[int]
    status: str
    status_code: int
    list: AppointmentListResponse
    one: AppointmentRetrieveResponse
    error: str
    def __init__(self, status: _Optional[str] = ..., status_code: _Optional[int] = ..., list: _Optional[_Union[AppointmentListResponse, _Mapping]] = ..., one: _Optional[_Union[AppointmentRetrieveResponse, _Mapping]] = ..., error: _Optional[str] = ...) -> None: ...
