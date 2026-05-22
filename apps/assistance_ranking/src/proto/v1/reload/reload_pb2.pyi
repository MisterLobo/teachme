from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from typing import ClassVar as _ClassVar, Optional as _Optional

DESCRIPTOR: _descriptor.FileDescriptor

class ReloadProto(_message.Message):
    __slots__ = ("done",)
    DONE_FIELD_NUMBER: _ClassVar[int]
    done: bool
    def __init__(self, done: _Optional[bool] = ...) -> None: ...
