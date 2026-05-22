from google.protobuf import timestamp_pb2 as _timestamp_pb2
from google.protobuf import any_pb2 as _any_pb2
from google.protobuf.internal import containers as _containers
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from collections.abc import Iterable as _Iterable, Mapping as _Mapping
from typing import ClassVar as _ClassVar, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class BookingCreate(_message.Message):
    __slots__ = ("date_time", "duration", "host_id", "confirmation_token", "payment_method", "enc_access_code", "host_session_keys", "guest_session_keys", "salt")
    class SessionKey(_message.Message):
        __slots__ = ("credential_id", "key_ciphertext", "key_type")
        CREDENTIAL_ID_FIELD_NUMBER: _ClassVar[int]
        KEY_CIPHERTEXT_FIELD_NUMBER: _ClassVar[int]
        KEY_TYPE_FIELD_NUMBER: _ClassVar[int]
        credential_id: str
        key_ciphertext: bytes
        key_type: str
        def __init__(self, credential_id: _Optional[str] = ..., key_ciphertext: _Optional[bytes] = ..., key_type: _Optional[str] = ...) -> None: ...
    DATE_TIME_FIELD_NUMBER: _ClassVar[int]
    DURATION_FIELD_NUMBER: _ClassVar[int]
    HOST_ID_FIELD_NUMBER: _ClassVar[int]
    CONFIRMATION_TOKEN_FIELD_NUMBER: _ClassVar[int]
    PAYMENT_METHOD_FIELD_NUMBER: _ClassVar[int]
    ENC_ACCESS_CODE_FIELD_NUMBER: _ClassVar[int]
    HOST_SESSION_KEYS_FIELD_NUMBER: _ClassVar[int]
    GUEST_SESSION_KEYS_FIELD_NUMBER: _ClassVar[int]
    SALT_FIELD_NUMBER: _ClassVar[int]
    date_time: str
    duration: int
    host_id: str
    confirmation_token: str
    payment_method: str
    enc_access_code: bytes
    host_session_keys: _containers.RepeatedCompositeFieldContainer[BookingCreate.SessionKey]
    guest_session_keys: _containers.RepeatedCompositeFieldContainer[BookingCreate.SessionKey]
    salt: bytes
    def __init__(self, date_time: _Optional[str] = ..., duration: _Optional[int] = ..., host_id: _Optional[str] = ..., confirmation_token: _Optional[str] = ..., payment_method: _Optional[str] = ..., enc_access_code: _Optional[bytes] = ..., host_session_keys: _Optional[_Iterable[_Union[BookingCreate.SessionKey, _Mapping]]] = ..., guest_session_keys: _Optional[_Iterable[_Union[BookingCreate.SessionKey, _Mapping]]] = ..., salt: _Optional[bytes] = ...) -> None: ...

class BookingCreateResponse(_message.Message):
    __slots__ = ("payment_link", "payment_intent", "client_secret", "booking_id")
    PAYMENT_LINK_FIELD_NUMBER: _ClassVar[int]
    PAYMENT_INTENT_FIELD_NUMBER: _ClassVar[int]
    CLIENT_SECRET_FIELD_NUMBER: _ClassVar[int]
    BOOKING_ID_FIELD_NUMBER: _ClassVar[int]
    payment_link: str
    payment_intent: str
    client_secret: str
    booking_id: str
    def __init__(self, payment_link: _Optional[str] = ..., payment_intent: _Optional[str] = ..., client_secret: _Optional[str] = ..., booking_id: _Optional[str] = ...) -> None: ...

class BookingResponse(_message.Message):
    __slots__ = ("status", "status_code", "error", "created", "listed")
    STATUS_FIELD_NUMBER: _ClassVar[int]
    STATUS_CODE_FIELD_NUMBER: _ClassVar[int]
    ERROR_FIELD_NUMBER: _ClassVar[int]
    CREATED_FIELD_NUMBER: _ClassVar[int]
    LISTED_FIELD_NUMBER: _ClassVar[int]
    status: str
    status_code: int
    error: str
    created: BookingCreateResponse
    listed: BookingListResponse
    def __init__(self, status: _Optional[str] = ..., status_code: _Optional[int] = ..., error: _Optional[str] = ..., created: _Optional[_Union[BookingCreateResponse, _Mapping]] = ..., listed: _Optional[_Union[BookingListResponse, _Mapping]] = ...) -> None: ...

class BookingList(_message.Message):
    __slots__ = ("start_date", "end_date", "duration")
    START_DATE_FIELD_NUMBER: _ClassVar[int]
    END_DATE_FIELD_NUMBER: _ClassVar[int]
    DURATION_FIELD_NUMBER: _ClassVar[int]
    start_date: str
    end_date: str
    duration: int
    def __init__(self, start_date: _Optional[str] = ..., end_date: _Optional[str] = ..., duration: _Optional[int] = ...) -> None: ...

class BookingListResponse(_message.Message):
    __slots__ = ("items",)
    ITEMS_FIELD_NUMBER: _ClassVar[int]
    items: _any_pb2.Any
    def __init__(self, items: _Optional[_Union[_any_pb2.Any, _Mapping]] = ...) -> None: ...
