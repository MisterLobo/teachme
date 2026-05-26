from google.protobuf import timestamp_pb2 as _timestamp_pb2
from google.protobuf import any_pb2 as _any_pb2
from google.protobuf import empty_pb2 as _empty_pb2
from google.protobuf.internal import containers as _containers
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from collections.abc import Iterable as _Iterable, Mapping as _Mapping
from typing import ClassVar as _ClassVar, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class CredentialRegisterBeginRequest(_message.Message):
    __slots__ = ()
    def __init__(self) -> None: ...

class CredentialRegisterBeginResponse(_message.Message):
    __slots__ = ("options_json", "session_id", "challenge")
    OPTIONS_JSON_FIELD_NUMBER: _ClassVar[int]
    SESSION_ID_FIELD_NUMBER: _ClassVar[int]
    CHALLENGE_FIELD_NUMBER: _ClassVar[int]
    options_json: bytes
    session_id: str
    challenge: bytes
    def __init__(self, options_json: _Optional[bytes] = ..., session_id: _Optional[str] = ..., challenge: _Optional[bytes] = ...) -> None: ...

class CredentialRegisterFinishRequest(_message.Message):
    __slots__ = ("session_id", "enc_mk", "mk_iv", "response", "master_keys")
    class WrappedMasterKey(_message.Message):
        __slots__ = ("cipher", "iv", "recovery_tag")
        CIPHER_FIELD_NUMBER: _ClassVar[int]
        IV_FIELD_NUMBER: _ClassVar[int]
        RECOVERY_TAG_FIELD_NUMBER: _ClassVar[int]
        cipher: bytes
        iv: bytes
        recovery_tag: bytes
        def __init__(self, cipher: _Optional[bytes] = ..., iv: _Optional[bytes] = ..., recovery_tag: _Optional[bytes] = ...) -> None: ...
    SESSION_ID_FIELD_NUMBER: _ClassVar[int]
    ENC_MK_FIELD_NUMBER: _ClassVar[int]
    MK_IV_FIELD_NUMBER: _ClassVar[int]
    RESPONSE_FIELD_NUMBER: _ClassVar[int]
    MASTER_KEYS_FIELD_NUMBER: _ClassVar[int]
    session_id: str
    enc_mk: bytes
    mk_iv: bytes
    response: bytes
    master_keys: _containers.RepeatedCompositeFieldContainer[CredentialRegisterFinishRequest.WrappedMasterKey]
    def __init__(self, session_id: _Optional[str] = ..., enc_mk: _Optional[bytes] = ..., mk_iv: _Optional[bytes] = ..., response: _Optional[bytes] = ..., master_keys: _Optional[_Iterable[_Union[CredentialRegisterFinishRequest.WrappedMasterKey, _Mapping]]] = ...) -> None: ...

class CredentialRegisterFinishResponse(_message.Message):
    __slots__ = ("success", "credential_id", "status", "status_code")
    SUCCESS_FIELD_NUMBER: _ClassVar[int]
    CREDENTIAL_ID_FIELD_NUMBER: _ClassVar[int]
    STATUS_FIELD_NUMBER: _ClassVar[int]
    STATUS_CODE_FIELD_NUMBER: _ClassVar[int]
    success: bool
    credential_id: str
    status: str
    status_code: str
    def __init__(self, success: _Optional[bool] = ..., credential_id: _Optional[str] = ..., status: _Optional[str] = ..., status_code: _Optional[str] = ...) -> None: ...

class CredentialLoginBeginRequest(_message.Message):
    __slots__ = ("email",)
    EMAIL_FIELD_NUMBER: _ClassVar[int]
    email: str
    def __init__(self, email: _Optional[str] = ...) -> None: ...

class CredentialLoginBeginResponse(_message.Message):
    __slots__ = ("challenge", "rp_id", "options_json", "session_id", "pid")
    CHALLENGE_FIELD_NUMBER: _ClassVar[int]
    RP_ID_FIELD_NUMBER: _ClassVar[int]
    OPTIONS_JSON_FIELD_NUMBER: _ClassVar[int]
    SESSION_ID_FIELD_NUMBER: _ClassVar[int]
    PID_FIELD_NUMBER: _ClassVar[int]
    challenge: str
    rp_id: str
    options_json: bytes
    session_id: str
    pid: bytes
    def __init__(self, challenge: _Optional[str] = ..., rp_id: _Optional[str] = ..., options_json: _Optional[bytes] = ..., session_id: _Optional[str] = ..., pid: _Optional[bytes] = ...) -> None: ...

class CredentialLoginFinishRequest(_message.Message):
    __slots__ = ("session_id", "response")
    SESSION_ID_FIELD_NUMBER: _ClassVar[int]
    RESPONSE_FIELD_NUMBER: _ClassVar[int]
    session_id: str
    response: bytes
    def __init__(self, session_id: _Optional[str] = ..., response: _Optional[bytes] = ...) -> None: ...

class CredentialLoginFinishResponse(_message.Message):
    __slots__ = ("success", "message", "enc_mk", "prf_salt", "recovery_tags")
    SUCCESS_FIELD_NUMBER: _ClassVar[int]
    MESSAGE_FIELD_NUMBER: _ClassVar[int]
    ENC_MK_FIELD_NUMBER: _ClassVar[int]
    PRF_SALT_FIELD_NUMBER: _ClassVar[int]
    RECOVERY_TAGS_FIELD_NUMBER: _ClassVar[int]
    success: bool
    message: str
    enc_mk: bytes
    prf_salt: bytes
    recovery_tags: bytes
    def __init__(self, success: _Optional[bool] = ..., message: _Optional[str] = ..., enc_mk: _Optional[bytes] = ..., prf_salt: _Optional[bytes] = ..., recovery_tags: _Optional[bytes] = ...) -> None: ...

class OpaqueRegisterBeginRequest(_message.Message):
    __slots__ = ("client_registration_state", "registration_request")
    CLIENT_REGISTRATION_STATE_FIELD_NUMBER: _ClassVar[int]
    REGISTRATION_REQUEST_FIELD_NUMBER: _ClassVar[int]
    client_registration_state: bytes
    registration_request: bytes
    def __init__(self, client_registration_state: _Optional[bytes] = ..., registration_request: _Optional[bytes] = ...) -> None: ...

class OpaqueRegisterBeginResponse(_message.Message):
    __slots__ = ("registration_response", "server_setup")
    REGISTRATION_RESPONSE_FIELD_NUMBER: _ClassVar[int]
    SERVER_SETUP_FIELD_NUMBER: _ClassVar[int]
    registration_response: str
    server_setup: str
    def __init__(self, registration_response: _Optional[str] = ..., server_setup: _Optional[str] = ...) -> None: ...

class OpaqueRegisterFinishRequest(_message.Message):
    __slots__ = ("registration_record",)
    REGISTRATION_RECORD_FIELD_NUMBER: _ClassVar[int]
    registration_record: bytes
    def __init__(self, registration_record: _Optional[bytes] = ...) -> None: ...

class OpaqueRegisterFinishResponse(_message.Message):
    __slots__ = ("status", "status_code", "error")
    STATUS_FIELD_NUMBER: _ClassVar[int]
    STATUS_CODE_FIELD_NUMBER: _ClassVar[int]
    ERROR_FIELD_NUMBER: _ClassVar[int]
    status: str
    status_code: int
    error: str
    def __init__(self, status: _Optional[str] = ..., status_code: _Optional[int] = ..., error: _Optional[str] = ...) -> None: ...

class OpaqueBatchRegisterBeginRequest(_message.Message):
    __slots__ = ("requests",)
    REQUESTS_FIELD_NUMBER: _ClassVar[int]
    requests: _containers.RepeatedCompositeFieldContainer[OpaqueRegisterBeginRequest]
    def __init__(self, requests: _Optional[_Iterable[_Union[OpaqueRegisterBeginRequest, _Mapping]]] = ...) -> None: ...

class OpaqueBatchRegisterBeginRespose(_message.Message):
    __slots__ = ("responses",)
    RESPONSES_FIELD_NUMBER: _ClassVar[int]
    responses: _containers.RepeatedCompositeFieldContainer[OpaqueRegisterBeginResponse]
    def __init__(self, responses: _Optional[_Iterable[_Union[OpaqueRegisterBeginResponse, _Mapping]]] = ...) -> None: ...

class OpaqueBatchRegisterFinishRequest(_message.Message):
    __slots__ = ("requests",)
    REQUESTS_FIELD_NUMBER: _ClassVar[int]
    requests: _containers.RepeatedCompositeFieldContainer[OpaqueRegisterFinishRequest]
    def __init__(self, requests: _Optional[_Iterable[_Union[OpaqueRegisterFinishRequest, _Mapping]]] = ...) -> None: ...

class OpaqueBatchRegisterFinishResponse(_message.Message):
    __slots__ = ("responses",)
    RESPONSES_FIELD_NUMBER: _ClassVar[int]
    responses: _containers.RepeatedCompositeFieldContainer[OpaqueRegisterFinishResponse]
    def __init__(self, responses: _Optional[_Iterable[_Union[OpaqueRegisterFinishResponse, _Mapping]]] = ...) -> None: ...

class OpaqueLoginBeginRequest(_message.Message):
    __slots__ = ("client_login_state", "start_login_request")
    CLIENT_LOGIN_STATE_FIELD_NUMBER: _ClassVar[int]
    START_LOGIN_REQUEST_FIELD_NUMBER: _ClassVar[int]
    client_login_state: bytes
    start_login_request: bytes
    def __init__(self, client_login_state: _Optional[bytes] = ..., start_login_request: _Optional[bytes] = ...) -> None: ...

class OpaqueLoginBeginResponse(_message.Message):
    __slots__ = ("login_response", "server_login_state")
    LOGIN_RESPONSE_FIELD_NUMBER: _ClassVar[int]
    SERVER_LOGIN_STATE_FIELD_NUMBER: _ClassVar[int]
    login_response: str
    server_login_state: str
    def __init__(self, login_response: _Optional[str] = ..., server_login_state: _Optional[str] = ...) -> None: ...

class OpaqueLoginFinishRequest(_message.Message):
    __slots__ = ("finish_login_request", "session_key")
    FINISH_LOGIN_REQUEST_FIELD_NUMBER: _ClassVar[int]
    SESSION_KEY_FIELD_NUMBER: _ClassVar[int]
    finish_login_request: bytes
    session_key: bytes
    def __init__(self, finish_login_request: _Optional[bytes] = ..., session_key: _Optional[bytes] = ...) -> None: ...

class OpaqueLoginFinishResponse(_message.Message):
    __slots__ = ("status", "status_code", "error", "salt")
    STATUS_FIELD_NUMBER: _ClassVar[int]
    STATUS_CODE_FIELD_NUMBER: _ClassVar[int]
    ERROR_FIELD_NUMBER: _ClassVar[int]
    SALT_FIELD_NUMBER: _ClassVar[int]
    status: str
    status_code: int
    error: str
    salt: bytes
    def __init__(self, status: _Optional[str] = ..., status_code: _Optional[int] = ..., error: _Optional[str] = ..., salt: _Optional[bytes] = ...) -> None: ...

class CredentialStoreDeviceParams(_message.Message):
    __slots__ = ("device_name", "description", "public_key", "enabled")
    DEVICE_NAME_FIELD_NUMBER: _ClassVar[int]
    DESCRIPTION_FIELD_NUMBER: _ClassVar[int]
    PUBLIC_KEY_FIELD_NUMBER: _ClassVar[int]
    ENABLED_FIELD_NUMBER: _ClassVar[int]
    device_name: str
    description: str
    public_key: str
    enabled: bool
    def __init__(self, device_name: _Optional[str] = ..., description: _Optional[str] = ..., public_key: _Optional[str] = ..., enabled: _Optional[bool] = ...) -> None: ...

class CredentialRetrieveDeviceParams(_message.Message):
    __slots__ = ("device_name",)
    DEVICE_NAME_FIELD_NUMBER: _ClassVar[int]
    device_name: str
    def __init__(self, device_name: _Optional[str] = ...) -> None: ...

class CredentialListDevicesParams(_message.Message):
    __slots__ = ("active",)
    ACTIVE_FIELD_NUMBER: _ClassVar[int]
    active: bool
    def __init__(self, active: _Optional[bool] = ...) -> None: ...

class CredentialDevice(_message.Message):
    __slots__ = ("name", "public_key", "description", "active", "enabled")
    NAME_FIELD_NUMBER: _ClassVar[int]
    PUBLIC_KEY_FIELD_NUMBER: _ClassVar[int]
    DESCRIPTION_FIELD_NUMBER: _ClassVar[int]
    ACTIVE_FIELD_NUMBER: _ClassVar[int]
    ENABLED_FIELD_NUMBER: _ClassVar[int]
    name: str
    public_key: str
    description: str
    active: bool
    enabled: bool
    def __init__(self, name: _Optional[str] = ..., public_key: _Optional[str] = ..., description: _Optional[str] = ..., active: _Optional[bool] = ..., enabled: _Optional[bool] = ...) -> None: ...

class CredentialDeviceResponse(_message.Message):
    __slots__ = ("devices",)
    DEVICES_FIELD_NUMBER: _ClassVar[int]
    devices: _containers.RepeatedCompositeFieldContainer[CredentialDevice]
    def __init__(self, devices: _Optional[_Iterable[_Union[CredentialDevice, _Mapping]]] = ...) -> None: ...

class CredentialStoreKeysParams(_message.Message):
    __slots__ = ("encoded_blob", "user_key", "session_key", "device_key", "key_type", "public_key", "credential_id", "salt")
    class UserKey(_message.Message):
        __slots__ = ("master_key_cipher", "salt", "key_cipher", "public_key")
        MASTER_KEY_CIPHER_FIELD_NUMBER: _ClassVar[int]
        SALT_FIELD_NUMBER: _ClassVar[int]
        KEY_CIPHER_FIELD_NUMBER: _ClassVar[int]
        PUBLIC_KEY_FIELD_NUMBER: _ClassVar[int]
        master_key_cipher: str
        salt: str
        key_cipher: str
        public_key: str
        def __init__(self, master_key_cipher: _Optional[str] = ..., salt: _Optional[str] = ..., key_cipher: _Optional[str] = ..., public_key: _Optional[str] = ...) -> None: ...
    class DeviceKey(_message.Message):
        __slots__ = ("master_key_cipher", "salt", "key_cipher", "public_key")
        MASTER_KEY_CIPHER_FIELD_NUMBER: _ClassVar[int]
        SALT_FIELD_NUMBER: _ClassVar[int]
        KEY_CIPHER_FIELD_NUMBER: _ClassVar[int]
        PUBLIC_KEY_FIELD_NUMBER: _ClassVar[int]
        master_key_cipher: str
        salt: str
        key_cipher: str
        public_key: str
        def __init__(self, master_key_cipher: _Optional[str] = ..., salt: _Optional[str] = ..., key_cipher: _Optional[str] = ..., public_key: _Optional[str] = ...) -> None: ...
    class SessionKey(_message.Message):
        __slots__ = ("code_cipher", "salt")
        CODE_CIPHER_FIELD_NUMBER: _ClassVar[int]
        SALT_FIELD_NUMBER: _ClassVar[int]
        code_cipher: bytes
        salt: bytes
        def __init__(self, code_cipher: _Optional[bytes] = ..., salt: _Optional[bytes] = ...) -> None: ...
    ENCODED_BLOB_FIELD_NUMBER: _ClassVar[int]
    USER_KEY_FIELD_NUMBER: _ClassVar[int]
    SESSION_KEY_FIELD_NUMBER: _ClassVar[int]
    DEVICE_KEY_FIELD_NUMBER: _ClassVar[int]
    KEY_TYPE_FIELD_NUMBER: _ClassVar[int]
    PUBLIC_KEY_FIELD_NUMBER: _ClassVar[int]
    CREDENTIAL_ID_FIELD_NUMBER: _ClassVar[int]
    SALT_FIELD_NUMBER: _ClassVar[int]
    encoded_blob: bytes
    user_key: CredentialStoreKeysParams.UserKey
    session_key: CredentialStoreKeysParams.SessionKey
    device_key: CredentialStoreKeysParams.DeviceKey
    key_type: str
    public_key: bytes
    credential_id: str
    salt: str
    def __init__(self, encoded_blob: _Optional[bytes] = ..., user_key: _Optional[_Union[CredentialStoreKeysParams.UserKey, _Mapping]] = ..., session_key: _Optional[_Union[CredentialStoreKeysParams.SessionKey, _Mapping]] = ..., device_key: _Optional[_Union[CredentialStoreKeysParams.DeviceKey, _Mapping]] = ..., key_type: _Optional[str] = ..., public_key: _Optional[bytes] = ..., credential_id: _Optional[str] = ..., salt: _Optional[str] = ...) -> None: ...

class CredentialRetrieveKeysParams(_message.Message):
    __slots__ = ("type",)
    TYPE_FIELD_NUMBER: _ClassVar[int]
    type: str
    def __init__(self, type: _Optional[str] = ...) -> None: ...

class CredentialResponse(_message.Message):
    __slots__ = ("status", "status_code", "user_key", "session_key", "list")
    class UserKey(_message.Message):
        __slots__ = ()
        def __init__(self) -> None: ...
    class SessionKey(_message.Message):
        __slots__ = ()
        def __init__(self) -> None: ...
    STATUS_FIELD_NUMBER: _ClassVar[int]
    STATUS_CODE_FIELD_NUMBER: _ClassVar[int]
    USER_KEY_FIELD_NUMBER: _ClassVar[int]
    SESSION_KEY_FIELD_NUMBER: _ClassVar[int]
    LIST_FIELD_NUMBER: _ClassVar[int]
    status: str
    status_code: int
    user_key: CredentialResponse.UserKey
    session_key: CredentialResponse.SessionKey
    list: CredentialDeviceResponse
    def __init__(self, status: _Optional[str] = ..., status_code: _Optional[int] = ..., user_key: _Optional[_Union[CredentialResponse.UserKey, _Mapping]] = ..., session_key: _Optional[_Union[CredentialResponse.SessionKey, _Mapping]] = ..., list: _Optional[_Union[CredentialDeviceResponse, _Mapping]] = ...) -> None: ...
