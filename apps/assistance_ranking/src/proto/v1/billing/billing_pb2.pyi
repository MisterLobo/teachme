from google.protobuf import timestamp_pb2 as _timestamp_pb2
from google.protobuf import any_pb2 as _any_pb2
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from collections.abc import Mapping as _Mapping
from typing import ClassVar as _ClassVar, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class BillingAddPaymentMethod(_message.Message):
    __slots__ = ()
    def __init__(self) -> None: ...

class BillingListPaymentMethods(_message.Message):
    __slots__ = ()
    def __init__(self) -> None: ...

class BillingProcessPayment(_message.Message):
    __slots__ = ("currency", "amount", "promo_code")
    CURRENCY_FIELD_NUMBER: _ClassVar[int]
    AMOUNT_FIELD_NUMBER: _ClassVar[int]
    PROMO_CODE_FIELD_NUMBER: _ClassVar[int]
    currency: str
    amount: float
    promo_code: str
    def __init__(self, currency: _Optional[str] = ..., amount: _Optional[float] = ..., promo_code: _Optional[str] = ...) -> None: ...

class BillingResponse(_message.Message):
    __slots__ = ("status", "data")
    STATUS_FIELD_NUMBER: _ClassVar[int]
    DATA_FIELD_NUMBER: _ClassVar[int]
    status: str
    data: _any_pb2.Any
    def __init__(self, status: _Optional[str] = ..., data: _Optional[_Union[_any_pb2.Any, _Mapping]] = ...) -> None: ...
