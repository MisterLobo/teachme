from google.protobuf import timestamp_pb2 as _timestamp_pb2
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from collections.abc import Mapping as _Mapping
from typing import ClassVar as _ClassVar, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class AuthLogin(_message.Message):
    __slots__ = ("email", "password")
    EMAIL_FIELD_NUMBER: _ClassVar[int]
    PASSWORD_FIELD_NUMBER: _ClassVar[int]
    email: str
    password: str
    def __init__(self, email: _Optional[str] = ..., password: _Optional[str] = ...) -> None: ...

class UserKey(_message.Message):
    __slots__ = ("key_cipher", "public_key", "salt", "master_key", "key_cipher_salt")
    class MasterKey(_message.Message):
        __slots__ = ("wrapped_cipher", "iv")
        WRAPPED_CIPHER_FIELD_NUMBER: _ClassVar[int]
        IV_FIELD_NUMBER: _ClassVar[int]
        wrapped_cipher: str
        iv: str
        def __init__(self, wrapped_cipher: _Optional[str] = ..., iv: _Optional[str] = ...) -> None: ...
    KEY_CIPHER_FIELD_NUMBER: _ClassVar[int]
    PUBLIC_KEY_FIELD_NUMBER: _ClassVar[int]
    SALT_FIELD_NUMBER: _ClassVar[int]
    MASTER_KEY_FIELD_NUMBER: _ClassVar[int]
    KEY_CIPHER_SALT_FIELD_NUMBER: _ClassVar[int]
    key_cipher: str
    public_key: str
    salt: str
    master_key: UserKey.MasterKey
    key_cipher_salt: str
    def __init__(self, key_cipher: _Optional[str] = ..., public_key: _Optional[str] = ..., salt: _Optional[str] = ..., master_key: _Optional[_Union[UserKey.MasterKey, _Mapping]] = ..., key_cipher_salt: _Optional[str] = ...) -> None: ...

class AuthSignup(_message.Message):
    __slots__ = ("email", "password", "username", "role", "country", "currency", "timezone", "title", "categories", "subjects", "primary_language", "locale", "plan", "is_trial", "first_name", "last_name", "session_duration", "session_price", "keys")
    EMAIL_FIELD_NUMBER: _ClassVar[int]
    PASSWORD_FIELD_NUMBER: _ClassVar[int]
    USERNAME_FIELD_NUMBER: _ClassVar[int]
    ROLE_FIELD_NUMBER: _ClassVar[int]
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
    KEYS_FIELD_NUMBER: _ClassVar[int]
    email: str
    password: str
    username: str
    role: int
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
    session_price: int
    keys: UserKey
    def __init__(self, email: _Optional[str] = ..., password: _Optional[str] = ..., username: _Optional[str] = ..., role: _Optional[int] = ..., country: _Optional[str] = ..., currency: _Optional[str] = ..., timezone: _Optional[str] = ..., title: _Optional[str] = ..., categories: _Optional[str] = ..., subjects: _Optional[str] = ..., primary_language: _Optional[str] = ..., locale: _Optional[str] = ..., plan: _Optional[str] = ..., is_trial: _Optional[bool] = ..., first_name: _Optional[str] = ..., last_name: _Optional[str] = ..., session_duration: _Optional[int] = ..., session_price: _Optional[int] = ..., keys: _Optional[_Union[UserKey, _Mapping]] = ...) -> None: ...

class LoginResponse(_message.Message):
    __slots__ = ("status", "status_code", "access_token", "refresh_token", "error", "keys")
    STATUS_FIELD_NUMBER: _ClassVar[int]
    STATUS_CODE_FIELD_NUMBER: _ClassVar[int]
    ACCESS_TOKEN_FIELD_NUMBER: _ClassVar[int]
    REFRESH_TOKEN_FIELD_NUMBER: _ClassVar[int]
    ERROR_FIELD_NUMBER: _ClassVar[int]
    KEYS_FIELD_NUMBER: _ClassVar[int]
    status: str
    status_code: int
    access_token: str
    refresh_token: str
    error: str
    keys: UserKey
    def __init__(self, status: _Optional[str] = ..., status_code: _Optional[int] = ..., access_token: _Optional[str] = ..., refresh_token: _Optional[str] = ..., error: _Optional[str] = ..., keys: _Optional[_Union[UserKey, _Mapping]] = ...) -> None: ...

class SignupResponse(_message.Message):
    __slots__ = ("status", "status_code", "error", "id")
    STATUS_FIELD_NUMBER: _ClassVar[int]
    STATUS_CODE_FIELD_NUMBER: _ClassVar[int]
    ERROR_FIELD_NUMBER: _ClassVar[int]
    ID_FIELD_NUMBER: _ClassVar[int]
    status: str
    status_code: int
    error: str
    id: str
    def __init__(self, status: _Optional[str] = ..., status_code: _Optional[int] = ..., error: _Optional[str] = ..., id: _Optional[str] = ...) -> None: ...

class AuthVerifyPasswordRequest(_message.Message):
    __slots__ = ("password",)
    PASSWORD_FIELD_NUMBER: _ClassVar[int]
    password: str
    def __init__(self, password: _Optional[str] = ...) -> None: ...

class AuthVerifyPasswordResponse(_message.Message):
    __slots__ = ("status", "status_code", "error")
    STATUS_FIELD_NUMBER: _ClassVar[int]
    STATUS_CODE_FIELD_NUMBER: _ClassVar[int]
    ERROR_FIELD_NUMBER: _ClassVar[int]
    status: str
    status_code: int
    error: str
    def __init__(self, status: _Optional[str] = ..., status_code: _Optional[int] = ..., error: _Optional[str] = ...) -> None: ...
