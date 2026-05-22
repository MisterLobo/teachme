from google.protobuf import timestamp_pb2 as _timestamp_pb2
from google.protobuf import any_pb2 as _any_pb2
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from collections.abc import Mapping as _Mapping
from typing import ClassVar as _ClassVar, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class AccountSetup(_message.Message):
    __slots__ = ()
    def __init__(self) -> None: ...

class AccountSetupResponse(_message.Message):
    __slots__ = ("status", "setup_link", "success_link", "refresh_link")
    STATUS_FIELD_NUMBER: _ClassVar[int]
    SETUP_LINK_FIELD_NUMBER: _ClassVar[int]
    SUCCESS_LINK_FIELD_NUMBER: _ClassVar[int]
    REFRESH_LINK_FIELD_NUMBER: _ClassVar[int]
    status: str
    setup_link: str
    success_link: str
    refresh_link: str
    def __init__(self, status: _Optional[str] = ..., setup_link: _Optional[str] = ..., success_link: _Optional[str] = ..., refresh_link: _Optional[str] = ...) -> None: ...

class AccountVerify(_message.Message):
    __slots__ = ()
    def __init__(self) -> None: ...

class AccountVerifyResponse(_message.Message):
    __slots__ = ("status", "verify_link", "success_link", "refresh_link")
    STATUS_FIELD_NUMBER: _ClassVar[int]
    VERIFY_LINK_FIELD_NUMBER: _ClassVar[int]
    SUCCESS_LINK_FIELD_NUMBER: _ClassVar[int]
    REFRESH_LINK_FIELD_NUMBER: _ClassVar[int]
    status: str
    verify_link: str
    success_link: str
    refresh_link: str
    def __init__(self, status: _Optional[str] = ..., verify_link: _Optional[str] = ..., success_link: _Optional[str] = ..., refresh_link: _Optional[str] = ...) -> None: ...

class AccountRetrieve(_message.Message):
    __slots__ = ("expanded", "account", "customer", "subscription")
    EXPANDED_FIELD_NUMBER: _ClassVar[int]
    ACCOUNT_FIELD_NUMBER: _ClassVar[int]
    CUSTOMER_FIELD_NUMBER: _ClassVar[int]
    SUBSCRIPTION_FIELD_NUMBER: _ClassVar[int]
    expanded: bool
    account: bool
    customer: bool
    subscription: bool
    def __init__(self, expanded: _Optional[bool] = ..., account: _Optional[bool] = ..., customer: _Optional[bool] = ..., subscription: _Optional[bool] = ...) -> None: ...

class AccountRetrieveResponse(_message.Message):
    __slots__ = ("account_id", "account_data", "customer_id", "customer_data", "subscription_id", "subscription_data")
    class AccountRetrieveAccountData(_message.Message):
        __slots__ = ("id", "email", "type", "status")
        ID_FIELD_NUMBER: _ClassVar[int]
        EMAIL_FIELD_NUMBER: _ClassVar[int]
        TYPE_FIELD_NUMBER: _ClassVar[int]
        STATUS_FIELD_NUMBER: _ClassVar[int]
        id: str
        email: str
        type: str
        status: str
        def __init__(self, id: _Optional[str] = ..., email: _Optional[str] = ..., type: _Optional[str] = ..., status: _Optional[str] = ...) -> None: ...
    class AccountRetrieveCustomerData(_message.Message):
        __slots__ = ("id", "email", "name", "status")
        ID_FIELD_NUMBER: _ClassVar[int]
        EMAIL_FIELD_NUMBER: _ClassVar[int]
        NAME_FIELD_NUMBER: _ClassVar[int]
        STATUS_FIELD_NUMBER: _ClassVar[int]
        id: str
        email: str
        name: str
        status: str
        def __init__(self, id: _Optional[str] = ..., email: _Optional[str] = ..., name: _Optional[str] = ..., status: _Optional[str] = ...) -> None: ...
    class AccountRetrieveSubscriptionData(_message.Message):
        __slots__ = ("id", "status")
        ID_FIELD_NUMBER: _ClassVar[int]
        STATUS_FIELD_NUMBER: _ClassVar[int]
        id: str
        status: str
        def __init__(self, id: _Optional[str] = ..., status: _Optional[str] = ...) -> None: ...
    ACCOUNT_ID_FIELD_NUMBER: _ClassVar[int]
    ACCOUNT_DATA_FIELD_NUMBER: _ClassVar[int]
    CUSTOMER_ID_FIELD_NUMBER: _ClassVar[int]
    CUSTOMER_DATA_FIELD_NUMBER: _ClassVar[int]
    SUBSCRIPTION_ID_FIELD_NUMBER: _ClassVar[int]
    SUBSCRIPTION_DATA_FIELD_NUMBER: _ClassVar[int]
    account_id: str
    account_data: AccountRetrieveResponse.AccountRetrieveAccountData
    customer_id: str
    customer_data: AccountRetrieveResponse.AccountRetrieveCustomerData
    subscription_id: str
    subscription_data: AccountRetrieveResponse.AccountRetrieveSubscriptionData
    def __init__(self, account_id: _Optional[str] = ..., account_data: _Optional[_Union[AccountRetrieveResponse.AccountRetrieveAccountData, _Mapping]] = ..., customer_id: _Optional[str] = ..., customer_data: _Optional[_Union[AccountRetrieveResponse.AccountRetrieveCustomerData, _Mapping]] = ..., subscription_id: _Optional[str] = ..., subscription_data: _Optional[_Union[AccountRetrieveResponse.AccountRetrieveSubscriptionData, _Mapping]] = ...) -> None: ...
