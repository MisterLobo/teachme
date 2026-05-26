from google.protobuf import timestamp_pb2 as _timestamp_pb2
from google.protobuf import any_pb2 as _any_pb2
from google.protobuf.internal import containers as _containers
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from collections.abc import Iterable as _Iterable, Mapping as _Mapping
from typing import ClassVar as _ClassVar, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class PaymentSetup(_message.Message):
    __slots__ = ("recipient_id", "sender_id")
    RECIPIENT_ID_FIELD_NUMBER: _ClassVar[int]
    SENDER_ID_FIELD_NUMBER: _ClassVar[int]
    recipient_id: str
    sender_id: str
    def __init__(self, recipient_id: _Optional[str] = ..., sender_id: _Optional[str] = ...) -> None: ...

class PaymentSetupResponse(_message.Message):
    __slots__ = ("setup_intent_id", "client_secret")
    SETUP_INTENT_ID_FIELD_NUMBER: _ClassVar[int]
    CLIENT_SECRET_FIELD_NUMBER: _ClassVar[int]
    setup_intent_id: str
    client_secret: str
    def __init__(self, setup_intent_id: _Optional[str] = ..., client_secret: _Optional[str] = ...) -> None: ...

class PaymentProcess(_message.Message):
    __slots__ = ("payment_intent_id",)
    PAYMENT_INTENT_ID_FIELD_NUMBER: _ClassVar[int]
    payment_intent_id: str
    def __init__(self, payment_intent_id: _Optional[str] = ...) -> None: ...

class PaymentProcessResponse(_message.Message):
    __slots__ = ("payment_intent_id",)
    PAYMENT_INTENT_ID_FIELD_NUMBER: _ClassVar[int]
    payment_intent_id: str
    def __init__(self, payment_intent_id: _Optional[str] = ...) -> None: ...

class PaymentMethodCard(_message.Message):
    __slots__ = ("last4", "exp_month", "exp_year", "brand", "display_brand", "description", "country", "issuer", "fingerprint")
    LAST4_FIELD_NUMBER: _ClassVar[int]
    EXP_MONTH_FIELD_NUMBER: _ClassVar[int]
    EXP_YEAR_FIELD_NUMBER: _ClassVar[int]
    BRAND_FIELD_NUMBER: _ClassVar[int]
    DISPLAY_BRAND_FIELD_NUMBER: _ClassVar[int]
    DESCRIPTION_FIELD_NUMBER: _ClassVar[int]
    COUNTRY_FIELD_NUMBER: _ClassVar[int]
    ISSUER_FIELD_NUMBER: _ClassVar[int]
    FINGERPRINT_FIELD_NUMBER: _ClassVar[int]
    last4: str
    exp_month: int
    exp_year: int
    brand: str
    display_brand: str
    description: str
    country: str
    issuer: str
    fingerprint: str
    def __init__(self, last4: _Optional[str] = ..., exp_month: _Optional[int] = ..., exp_year: _Optional[int] = ..., brand: _Optional[str] = ..., display_brand: _Optional[str] = ..., description: _Optional[str] = ..., country: _Optional[str] = ..., issuer: _Optional[str] = ..., fingerprint: _Optional[str] = ...) -> None: ...

class PaymentMethod(_message.Message):
    __slots__ = ("id", "card", "type", "is_default")
    ID_FIELD_NUMBER: _ClassVar[int]
    CARD_FIELD_NUMBER: _ClassVar[int]
    TYPE_FIELD_NUMBER: _ClassVar[int]
    IS_DEFAULT_FIELD_NUMBER: _ClassVar[int]
    id: str
    card: PaymentMethodCard
    type: str
    is_default: bool
    def __init__(self, id: _Optional[str] = ..., card: _Optional[_Union[PaymentMethodCard, _Mapping]] = ..., type: _Optional[str] = ..., is_default: _Optional[bool] = ...) -> None: ...

class PaymentListMethods(_message.Message):
    __slots__ = ("default",)
    DEFAULT_FIELD_NUMBER: _ClassVar[int]
    default: bool
    def __init__(self, default: _Optional[bool] = ...) -> None: ...

class PaymentListMethodsResponse(_message.Message):
    __slots__ = ("status", "data")
    STATUS_FIELD_NUMBER: _ClassVar[int]
    DATA_FIELD_NUMBER: _ClassVar[int]
    status: str
    data: _containers.RepeatedCompositeFieldContainer[PaymentMethod]
    def __init__(self, status: _Optional[str] = ..., data: _Optional[_Iterable[_Union[PaymentMethod, _Mapping]]] = ...) -> None: ...

class PaymentAttachMethod(_message.Message):
    __slots__ = ("id",)
    ID_FIELD_NUMBER: _ClassVar[int]
    id: str
    def __init__(self, id: _Optional[str] = ...) -> None: ...

class PaymentAttachMethodResponse(_message.Message):
    __slots__ = ("status", "status_code", "error", "attached_id")
    STATUS_FIELD_NUMBER: _ClassVar[int]
    STATUS_CODE_FIELD_NUMBER: _ClassVar[int]
    ERROR_FIELD_NUMBER: _ClassVar[int]
    ATTACHED_ID_FIELD_NUMBER: _ClassVar[int]
    status: str
    status_code: int
    error: str
    attached_id: str
    def __init__(self, status: _Optional[str] = ..., status_code: _Optional[int] = ..., error: _Optional[str] = ..., attached_id: _Optional[str] = ...) -> None: ...
