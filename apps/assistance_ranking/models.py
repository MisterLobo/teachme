from typing import Any, Optional
import datetime
import decimal
import enum
import uuid

from pgvector.sqlalchemy.vector import VECTOR
from sqlalchemy import ARRAY, BigInteger, Date, DateTime, Enum, Integer, Numeric, PrimaryKeyConstraint, String, Text, UniqueConstraint, Uuid, text
from sqlalchemy.dialects.postgresql import JSONB, MONEY
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

class Base(DeclarativeBase):
    pass


class CustomerType(str, enum.Enum):
    STUDENT_LEARNER = 'student_learner'
    PARENT_GUARDIAN = 'parent_guardian'


class OwnerType(str, enum.Enum):
    STUDENT_LEARNER = 'student_learner'
    PARENT_GUARDIAN = 'parent_guardian'


class TenantType(str, enum.Enum):
    INDIVIDUAL = 'individual'
    ORGANIZATION = 'organization'


class Appointments(Base):
    __tablename__ = 'appointments'
    __table_args__ = (
        PrimaryKeyConstraint('id', name='appointments_pkey'),
    )

    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text('CURRENT_TIMESTAMP'))
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text('CURRENT_TIMESTAMP'))
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    host_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    attendee_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    start_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False)
    duration: Mapped[int] = mapped_column(Integer, nullable=False)
    cal_booking_id: Mapped[Optional[str]] = mapped_column(String)


class Customers(Base):
    __tablename__ = 'customers'
    __table_args__ = (
        PrimaryKeyConstraint('id', name='customers_pkey'),
    )

    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text('CURRENT_TIMESTAMP'))
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text('CURRENT_TIMESTAMP'))
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    customer_type: Mapped[CustomerType] = mapped_column(Enum(CustomerType, values_callable=lambda cls: [member.value for member in cls], name='customer_type'), nullable=False)
    reference_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False)
    plan: Mapped[Optional[str]] = mapped_column(String)
    stripe_customer_id: Mapped[Optional[str]] = mapped_column(String)
    trial_ends_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True))


class Organizations(Base):
    __tablename__ = 'organizations'
    __table_args__ = (
        PrimaryKeyConstraint('id', name='organizations_pkey'),
    )

    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text('CURRENT_TIMESTAMP'))
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text('CURRENT_TIMESTAMP'))
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    contact_email: Mapped[str] = mapped_column(String, nullable=False)
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)


class Parents(Base):
    __tablename__ = 'parents'
    __table_args__ = (
        PrimaryKeyConstraint('id', name='parents_pkey'),
    )

    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text('CURRENT_TIMESTAMP'))
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text('CURRENT_TIMESTAMP'))
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    first_name: Mapped[str] = mapped_column(String, nullable=False)
    last_name: Mapped[str] = mapped_column(String, nullable=False)
    dob: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    sex: Mapped[Optional[str]] = mapped_column(String)
    num_child: Mapped[Optional[int]] = mapped_column(Integer)
    customer_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)


class Purchases(Base):
    __tablename__ = 'purchases'
    __table_args__ = (
        PrimaryKeyConstraint('id', name='purchases_pkey'),
    )

    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text('CURRENT_TIMESTAMP'))
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text('CURRENT_TIMESTAMP'))
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    unit_amount: Mapped[Optional[decimal.Decimal]] = mapped_column(Numeric)
    qty: Mapped[Optional[int]] = mapped_column(Integer)
    total: Mapped[Optional[decimal.Decimal]] = mapped_column(Numeric)
    transaction_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)


class SeaqlMigrations(Base):
    __tablename__ = 'seaql_migrations'
    __table_args__ = (
        PrimaryKeyConstraint('version', name='seaql_migrations_pkey'),
    )

    version: Mapped[str] = mapped_column(String, primary_key=True)
    applied_at: Mapped[int] = mapped_column(BigInteger, nullable=False)


class SearchPrompts(Base):
    __tablename__ = 'search_prompts'
    __table_args__ = (
        PrimaryKeyConstraint('id', name='search_prompts_pkey'),
    )

    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text('CURRENT_TIMESTAMP'))
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text('CURRENT_TIMESTAMP'))
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    owner_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    owner_type: Mapped[Optional[OwnerType]] = mapped_column(Enum(OwnerType, values_callable=lambda cls: [member.value for member in cls], name='owner_type'))
    prompt_text: Mapped[Optional[str]] = mapped_column(Text)
    prompt_embedding: Mapped[Optional[list[Any]]] = mapped_column(ARRAY(VECTOR()))


class Students(Base):
    __tablename__ = 'students'
    __table_args__ = (
        PrimaryKeyConstraint('id', name='students_pkey'),
    )

    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text('CURRENT_TIMESTAMP'))
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text('CURRENT_TIMESTAMP'))
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    first_name: Mapped[str] = mapped_column(String, nullable=False)
    last_name: Mapped[str] = mapped_column(String, nullable=False)
    dob: Mapped[Optional[datetime.date]] = mapped_column(Date)
    gender: Mapped[Optional[str]] = mapped_column(String)
    parent_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    customer_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)


class Tenants(Base):
    __tablename__ = 'tenants'
    __table_args__ = (
        PrimaryKeyConstraint('id', name='tenants_pkey'),
    )

    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text('CURRENT_TIMESTAMP'))
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text('CURRENT_TIMESTAMP'))
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    owner_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    tenant_type: Mapped[TenantType] = mapped_column(Enum(TenantType, values_callable=lambda cls: [member.value for member in cls], name='tenant_type'), nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)


class Transactions(Base):
    __tablename__ = 'transactions'
    __table_args__ = (
        PrimaryKeyConstraint('id', name='transactions_pkey'),
    )

    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text('CURRENT_TIMESTAMP'))
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text('CURRENT_TIMESTAMP'))
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    initiated_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True))
    completed_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True))
    status: Mapped[Optional[str]] = mapped_column(String)
    appointment_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    purpose: Mapped[Optional[str]] = mapped_column(String)
    stripe_payment_intent_id: Mapped[Optional[str]] = mapped_column(String)
    stripe_invoice_id: Mapped[Optional[str]] = mapped_column(String)
    tenant_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    biller: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    billed_to: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)


class TutorialSessions(Base):
    __tablename__ = 'tutorial_sessions'
    __table_args__ = (
        PrimaryKeyConstraint('id', name='tutorial_sessions_pkey'),
    )

    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text('CURRENT_TIMESTAMP'))
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text('CURRENT_TIMESTAMP'))
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    tutor_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    student_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    appointment_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    status: Mapped[Optional[str]] = mapped_column(String)
    progress: Mapped[Optional[str]] = mapped_column(String)
    session_link: Mapped[Optional[str]] = mapped_column(String)
    session_length_secs: Mapped[Optional[int]] = mapped_column(Integer)


class Tutors(Base):
    __tablename__ = 'tutors'
    __table_args__ = (
        PrimaryKeyConstraint('id', name='tutors_pkey'),
    )

    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text('CURRENT_TIMESTAMP'))
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text('CURRENT_TIMESTAMP'))
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    first_name: Mapped[str] = mapped_column(String, nullable=False)
    last_name: Mapped[str] = mapped_column(String, nullable=False)
    country: Mapped[str] = mapped_column(String, nullable=False)
    currency: Mapped[str] = mapped_column(String, nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    primary_language: Mapped[str] = mapped_column(String, nullable=False)
    availability_schedules: Mapped[dict] = mapped_column(JSONB, nullable=False)
    event_types: Mapped[dict] = mapped_column(JSONB, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False)
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    session_duration: Mapped[int] = mapped_column(Integer, nullable=False)
    city: Mapped[Optional[str]] = mapped_column(String)
    organization_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    dob: Mapped[Optional[datetime.date]] = mapped_column(Date)
    other_languages: Mapped[Optional[dict]] = mapped_column(JSONB)
    bio: Mapped[Optional[str]] = mapped_column(String)
    categories_subjects: Mapped[Optional[dict]] = mapped_column(JSONB)
    code: Mapped[Optional[str]] = mapped_column(String)
    stripe_connect_id: Mapped[Optional[str]] = mapped_column(String)
    default_calendar: Mapped[Optional[str]] = mapped_column(String)
    calendars: Mapped[Optional[dict]] = mapped_column(JSONB)
    session_price: Mapped[Optional[Any]] = mapped_column(MONEY)
    embedding: Mapped[Optional[list[Any]]] = mapped_column(ARRAY(VECTOR()))


class Users(Base):
    __tablename__ = 'users'
    __table_args__ = (
        PrimaryKeyConstraint('id', name='users_pkey'),
        UniqueConstraint('email', name='users_email_key')
    )

    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text('CURRENT_TIMESTAMP'))
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text('CURRENT_TIMESTAMP'))
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    pid: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    email: Mapped[str] = mapped_column(String, nullable=False)
    password: Mapped[str] = mapped_column(String, nullable=False)
    api_key: Mapped[str] = mapped_column(Text, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    email_verified_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True))
    reset_token: Mapped[Optional[str]] = mapped_column(Text)
    reset_sent_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True))
    email_verification_token: Mapped[Optional[str]] = mapped_column(String)
    email_verification_sent_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True))
    magic_link_token: Mapped[Optional[str]] = mapped_column(String)
    magic_link_expiration: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True))
    cal_user_id: Mapped[Optional[int]] = mapped_column(Integer)
    phone: Mapped[Optional[str]] = mapped_column(String)
    phone_verified_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True))
