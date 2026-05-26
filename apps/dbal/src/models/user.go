package models

import (
	"context"
	"crypto/rand"
	"database/sql/driver"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/go-playground/validator/v10"
	"github.com/go-webauthn/webauthn/webauthn"
	"github.com/gofiber/fiber/v3/log"
	"github.com/google/uuid"
	authpb "github.com/misterlobo/teachme/generated/v1/auth"
	"github.com/misterlobo/teachme/src/db"
	"github.com/misterlobo/teachme/src/lib"
	"github.com/misterlobo/teachme/src/utils"
	"github.com/uptrace/bun"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type UserRole string

const (
	RoleTenant   UserRole = "tenant"
	RoleCustomer UserRole = "customer"
)

type User struct {
	bun.BaseModel
	Timestamps
	ID                      uuid.UUID `bun:"id,pk,type:uuid,default:gen_random_uuid()"`
	Name                    string    `json:"name,omitempty"`
	Pid                     uuid.UUID `bun:"pid,unique,type:uuid,default:gen_random_uuid()" json:"pid,omitempty"`
	Email                   string    `bun:",unique:email_domain" json:"email,omitempty" validate:"required,email"`
	Password                string    `json:"-"`
	EmailVerifiedAt         *time.Time
	PhoneVerifiedAt         *time.Time
	ResetToken              *string
	ResetSentAt             *time.Time
	EmailVerificationToken  *string
	EmailVerificationSentAt *time.Time
	MagicLinkToken          *string
	MagicLinkExpiration     *time.Time
	CalUserId               *int
	CalUsername             *string
	Phone                   *string
	Role                    *UserRole         `bun:"type:user_role"`
	Metadata                *map[string]any   `bun:"type:jsonb"`
	SecurityManifest        *SecurityManifest `bun:"user_key,type:jsonb"`

	Subscription *Subscription `bun:"rel:has-one,join:id=id"`
	Devices      []*Device     `bun:"rel:has-many,join:id=user_id"`
}

type UserCreated struct {
	ID             uuid.UUID
	PID            uuid.UUID
	TenantID       *uuid.UUID
	CustomerID     *uuid.UUID
	RoleID         *uuid.UUID
	SubscriptionID *uuid.UUID
	Type           string
	Role           UserRole
	User           *User
	Tenant         *Tenant
	Customer       *Customer
	Tutor          *Tutor
	Student        *Student
	Organization   *Organization
	Parent         *Parent
	Subscription   *Subscription
}

type SecurityManifest struct {
	Salt                 string  `json:"salt"`
	PrivateKeyCipher     string  `json:"privateKeyCipher"`
	PrivateKeyCipherSalt string  `bun:",type:bytea" json:"privateKeyCipherSalt"`
	PublicKey            string  `json:"publicKey"`
	MasterKeyCipher      string  `json:"masterKeyCipher"`
	MasterKeyIV          string  `json:"masterKeyIv"`
	Description          string  `json:"description"`
	KdfAlgorithm         *string `json:"kdfAlgorithm"`
	KdfIterations        *uint   `json:"kdfIterations"`
}

type UserKey struct {
	bun.BaseModel
	Timestamps
	ID                 uuid.UUID  `bun:"id,pk,type:uuid,default:gen_random_uuid()"`
	UserID             uuid.UUID  `bun:",type:uuid"`
	DeviceID           *uuid.UUID `bun:",type:uuid"`
	CredentialId       *string    `bun:",unique"`
	EncPrivateKey      *string    `bun:"private_key,type:bytea"`
	PublicKey          []byte     `bun:"public_key,type:bytea"`
	KeyType            string
	Salt               string            `bun:",type:bytea"`
	RegistrationRecord *string           `bun:"record,type:bytea"`
	SecurityManifest   *SecurityManifest `bun:",type:jsonb"`
	EncodedCipherBlob  *string           `bun:"enc_blob,type:bytea"`

	Owner  *User   `bun:"rel:belongs-to,join:user_id=id"`
	Device *Device `bun:"rel:belongs-to,join:device_id=id"`
}

type WrappedMasterKey struct {
	Cipher []byte `bun:"cipher,array"`
	IV     []byte `bun:"iv,array"`
}

type RecoveryTag struct {
	Tag          []byte `json:"tag"`
	EncMasterKey []byte `json:"emk"`
	IV           []byte `json:"iv"`
}

type Device struct {
	bun.BaseModel
	Timestamps
	ID        uuid.UUID `bun:"id,pk,type:uuid,default:gen_random_uuid()"`
	UserID    uuid.UUID `bun:",type:uuid"`
	PublicKey string    `bun:"public_key"`
	// EncPrivateKey  *string   `bun:",type:bytea"`
	Revoked        bool
	RevokedAt      *time.Time        `bun:",type:timestamptz"`
	LastUsedAt     *time.Time        `bun:",type:timestamptz"`
	EncMasterKey   *WrappedMasterKey `bun:"emk,type:jsonb"`
	Label          string
	PrfSalt        string
	CredentialId   string
	CredentialType string
	Credential     []byte         `bun:",type:bytea"`
	RecoveryTags   []*RecoveryTag `bun:",type:jsonb"`

	Owner *User `bun:"rel:belongs-to,join:user_id=id"`
}

type DeviceGroupKey struct {
	bun.BaseModel
	Timestamps
	ID          uuid.UUID `bun:"id,pk,type:uuid,default:gen_random_uuid()"`
	UserID      uuid.UUID `bun:"user_id,type:uuid"`
	DeviceID    uuid.UUID `bun:",type:uuid"`
	EncGroupKey string
	RoleID      *uuid.UUID `bun:",type:uuid"`
	RoleType    *UserRole  `bun:",type:user_role"`
	SessionID   *uuid.UUID `bun:",type:uuid"`

	Device  *Device          `bun:"rel:belongs-to,join:device_id=id" json:"-"`
	Session *TutorialSession `bun:"rel:belongs-to,join:session_id=id" json:"-"`
	User    *User            `bun:"rel:belongs-to,join:user_id=id" json:"-"`
}

type WebauthnUser struct {
	inner       *User
	credentials []webauthn.Credential
}

type IdentityKey struct {
	bun.BaseModel
	Timestamps
	ID          uuid.UUID `bun:"id,pk,type:uuid,default:gen_random_uuid()"`
	UserID      uuid.UUID `bun:"user_id,type:uuid"`
	Type        string
	Description *string
	Manifest    *SecurityManifest `bun:",type:jsonb"`
}

func (u *WebauthnUser) WebAuthnID() []byte                         { return []byte(u.inner.ID.String()) }
func (u *WebauthnUser) WebAuthnName() string                       { return u.inner.Name }
func (u *WebauthnUser) WebAuthnDisplayName() string                { return u.inner.Name }
func (u *WebauthnUser) WebAuthnCredentials() []webauthn.Credential { return u.credentials }

func CreateUserRoleType(db *bun.DB) error {
	_, err := db.Exec("CREATE TYPE user_role AS ENUM ('tenant', 'customer');")
	return err
}

func (ct *UserRole) Scan(value interface{}) error {
	*ct = UserRole(value.([]byte))
	return nil
}

func (ct UserRole) Value() (driver.Value, error) {
	return string(ct), nil
}

func CreateUsersTable(ctx context.Context, db *bun.DB) error {
	_, err := db.NewCreateTable().
		Model((*User)(nil)).
		IfNotExists().
		Exec(ctx)

	return err
}

func DropUsersTable(ctx context.Context, db *bun.DB) error {
	_, err := db.NewDropTable().
		Model((*User)(nil)).
		IfExists().
		Cascade().
		Exec(ctx)
	return err
}

func FindUserForAuth(ctx context.Context, db *bun.DB, authParams *authpb.AuthLogin) (*User, error) {
	if authParams == nil {
		return nil, status.Error(codes.InvalidArgument, "invalid credentials")
	}
	user := new(User)
	db.Exec("SET LOCAL ROLE service_role;")
	exists, err := db.NewSelect().
		Model((*User)(nil)).
		Where("email = ?", authParams.GetEmail()).
		Exists(ctx)
	if err != nil {
		log.Errorf("Error querying users table: %v", err)
		return nil, err
	}
	if !exists {
		return nil, fmt.Errorf("could not find user: %s", authParams.GetEmail())
	}
	if err := db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		err := tx.NewSelect().
			Model(&User{Email: authParams.GetEmail()}).
			Where("email = ?", authParams.GetEmail()).
			Limit(1).
			Scan(ctx, user)
		if err != nil {
			return err
		}
		if user == nil {
			return errors.New("user not found")
		}
		return nil
	}); err != nil {
		log.Errorf("Error querying user: %v", err)
		return nil, err
	}

	log.Debugf("u: %v", user)
	return user, nil
}

func CreateUserWithPassword(ctx context.Context, params *authpb.AuthSignup) error {
	hash, err := utils.CreateHashedPassword(params.GetPassword(), &utils.PasswordParams{
		Iterations:  1,
		Memory:      64 * 1024,
		Parallelism: 4,
		KeyLength:   32,
	})
	if err != nil {
		log.Errorf("Could not create hashed password: %v", err)
		return err
	}
	db := db.GetDb()
	db.Exec("SET LOCAL ROLE service_role;")
	if err := db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		var role string
		if params.GetRole() == 1 {
			role = "tenant"
		} else if params.GetRole() == 2 {
			role = "customer"
		} else {
			role = "unknown"
		}
		pid, _ := uuid.NewV7()
		username := params.GetUsername()
		if username == "" {
			salt := make([]byte, 16)
			if _, err = rand.Read(salt); err != nil {
			}
			username = fmt.Sprintf("user_%s", base64.URLEncoding.EncodeToString(salt))
		}
		r := UserRole(role)
		user := User{
			Email:    params.GetEmail(),
			Password: hash,
			Pid:      pid,
			Name:     username,
			Role:     &r,
		}
		if err := validator.New(validator.WithRequiredStructEnabled()).Struct(user); err != nil {
			log.Errorf("Validation failed: %v", err)
			return err
		}
		exists, err := tx.NewSelect().
			Model(&User{Email: params.GetEmail()}).
			Where("email = ?", params.GetEmail()).
			Exists(ctx)
		if exists {
			return errors.New("email already in use")
		}

		_, err = tx.NewInsert().Model(&user).Exec(ctx)
		if err != nil {
			log.Errorf("error: %T", err)
			return err
		}

		return nil
	}); err != nil {
		log.Errorf("Error creating user: %v", err)
		return err
	}
	return nil
}

func CreateUserWithPasswordAndSubscription(ctx context.Context, params *authpb.AuthSignup) (*UserCreated, error) {
	uc := new(UserCreated)
	hash, err := utils.CreateHashedPassword(params.GetPassword(), &utils.PasswordParams{
		Iterations:  1,
		Memory:      64 * 1024,
		Parallelism: 4,
		KeyLength:   32,
	})
	if err != nil {
		log.Errorf("Could not create hashed password: %v", err)
		return nil, err
	}
	paramsRole := params.GetRole()
	log.Debugf("paramsRole: %d", paramsRole)
	db := db.GetDb()
	rc := lib.GetRedisClient(ctx)
	if err := db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		tx.Exec("SET LOCAL ROLE service_role;")
		var role string
		switch paramsRole {
		case 1, 3:
			role = string(RoleTenant)
		case 2, 4:
			role = string(RoleCustomer)
		default:
			role = "unknown"
		}
		log.Debugf("role: %s", role)
		pid, _ := uuid.NewV7()
		username := params.GetUsername()
		if username == "" {
			salt := make([]byte, 8)
			if _, err = rand.Read(salt); err != nil {
			}
			username = fmt.Sprintf("user_%s", hex.EncodeToString(salt))
		}
		log.Debugf("user role: %s", UserRole(role))
		r := UserRole(role)
		keys := params.GetKeys()
		user := User{
			Email:    params.GetEmail(),
			Password: hash,
			Pid:      pid,
			Name:     username,
			Role:     &r,
		}
		if keys != nil {
			user.SecurityManifest = &SecurityManifest{
				Description:      "User key args",
				Salt:             keys.GetSalt(),
				PublicKey:        keys.GetPublicKey(),
				PrivateKeyCipher: keys.GetKeyCipher(),
				MasterKeyCipher:  keys.GetMasterKey().GetWrappedCipher(),
				MasterKeyIV:      keys.GetMasterKey().GetIv(),
				KdfIterations:    utils.UintPtr(100_000),
				KdfAlgorithm:     utils.StringPtr(""),
			}
		}
		if err := validator.New(validator.WithRequiredStructEnabled()).Struct(user); err != nil {
			log.Errorf("Validation failed: %v", err)
			return err
		}
		exists, err := tx.NewSelect().
			Model(&User{Email: params.GetEmail()}).
			Where("email = ?", params.GetEmail()).
			Exists(ctx)
		if exists {
			return errors.New("email already in use")
		}

		_, err = tx.NewInsert().Model(&user).Returning("id", "pid", "username", "email").Exec(ctx)
		if err != nil {
			log.Errorf("error: %T", err)
			return err
		}
		tx.ExecContext(ctx, `
		SET LOCAL app.pid = ?;
		SET LOCAL app.user_id = ?;
		SET LOCAL app.role = ?;
		SET LOCAL ROLE authenticated;
		`, pid, user.ID, user.Role)
		uc = &UserCreated{ID: user.ID, PID: pid}
		// rc.Set(ctx, pid.String(), uc, 5*time.Minute)
		cacheKey := fmt.Sprintf("worker:{%s}", pid.String())
		jid, _ := uuid.NewV7()
		rc.JSONSet(ctx, cacheKey, "$", map[string]any{
			"jobID": jid,
			"ts":    time.Now(),
		})
		// rc.JSONSet(ctx, cacheKey, "$.user", &user)
		rc.Expire(ctx, cacheKey, 15*time.Minute)
		uc.User = &user

		var tenantType TenantType
		var customerType CustomerType
		var name string
		switch paramsRole {
		case 1:
			tenantType = TutorIndividual
			name = "Personal"
		case 3:
			tenantType = TutorOrganization
			name = params.GetUsername()
		case 2:
			customerType = StudentLearner
			name = fmt.Sprintf("%s %s", params.GetFirstName(), params.GetLastName())
		case 4:
			customerType = ParentGuardian
			name = fmt.Sprintf("%s %s", params.GetFirstName(), params.GetLastName())
		default:
			return errors.New("invalid role")
		}
		plan := params.GetPlan()
		var subId *uuid.UUID
		var tenantID *uuid.UUID
		var customerID *uuid.UUID
		if tenantType != "" {
			tenant := Tenant{
				OwnerID:    user.ID,
				Name:       name,
				Plan:       plan,
				TenantType: TenantType(tenantType),
			}
			_, err = tx.NewInsert().Model(&tenant).Exec(ctx)
			if err != nil {
				log.Errorf("error: %v", err)
				return err
			}
			tenantID = &tenant.ID
			subId = tenantID
			// rc.JSONSet(ctx, cacheKey, "$.tenant", &tenant)
			uc.Tenant = &tenant
			uc.RoleID = tenantID
			if _, err := tx.ExecContext(ctx, `
			SET LOCAL app.tenant_id = ?;
			`, tenantID); err != nil {
				return err
			}
			if tenantType == TutorIndividual {
				country := params.GetCountry()
				currency := params.GetCurrency()
				if country == "" {
					country = "us"
				}
				if currency == "" {
					currency = "usd"
				}
				log.Infof("tenantID: %s", tenantID)
				tutor := Tutor{
					FirstName:       params.GetFirstName(),
					LastName:        params.GetLastName(),
					Title:           params.Title,
					Country:         params.GetCountry(),
					Currency:        params.GetCurrency(),
					Timezone:        params.GetTimezone(),
					Categories:      params.Categories,
					Subjects:        params.Subjects,
					SessionDuration: uint(params.GetSessionDuration()),
					SessionPrice:    int64(params.GetSessionPrice()),
					PrimaryLanguage: params.PrimaryLanguage,
					Status:          "active",
					TenantID:        *tenantID,
				}
				_, err = tx.NewInsert().Model(&tutor).Exec(ctx)
				if err != nil {
					log.Errorf("error: %v", err)
					return err
				}
				if _, err := tx.ExecContext(ctx, `
				SET LOCAL app.tutor_id = ?;
				`, tutor.ID); err != nil {
					return err
				}
				// rc.JSONSet(ctx, cacheKey, "$.tutor", &tutor)
				uc.Tutor = &tutor

				uc.Type = string(TutorIndividual)
				uc.Role = RoleTenant
				uc.RoleID = &tutor.ID
			}
			if tenantType == TutorOrganization {
				org := Organization{
					Name:         name,
					TenantID:     tenant.ID,
					ContactEmail: params.GetEmail(),
					Size:         5,
				}
				_, err = tx.NewInsert().Model(&org).Exec(ctx)
				if err != nil {
					log.Errorf("error: %v", err)
					return err
				}
				if _, err := tx.ExecContext(ctx, `
				SET LOCAL app.organization_id = ?;
				`, org.ID); err != nil {
					return err
				}
				// rc.JSONSet(ctx, cacheKey, "$.org", &org)
				uc.Organization = &org
				uc.Type = string(TutorOrganization)
				uc.Role = RoleTenant
				uc.RoleID = &org.ID
			}
		}
		if customerType != "" {
			customer := Customer{
				UserID:       user.ID,
				CustomerType: CustomerType(customerType),
				Plan:         &plan,
			}
			_, err = tx.NewInsert().Model(&customer).Exec(ctx)
			if err != nil {
				log.Errorf("error: %v", err)
				return err
			}
			if _, err := tx.ExecContext(ctx, `
			SET LOCAL app.customer_id = ?;
			`, customer.ID); err != nil {
				return err
			}
			uid, _ := uuid.Parse(customer.ID.String())
			customerID = &uid
			subId = customerID
			uc.CustomerID = &uid
			// rc.JSONSet(ctx, cacheKey, "$.customer", &customer)
			uc.Customer = &customer
			if customerType == StudentLearner {
				student := Student{
					FirstName:  params.GetFirstName(),
					LastName:   params.GetLastName(),
					Country:    params.GetCountry(),
					Currency:   params.GetCurrency(),
					CustomerID: customerID,
					Timezone:   params.Timezone,
					Language:   params.GetPrimaryLanguage(),
				}
				_, err = tx.NewInsert().Model(&student).Exec(ctx)
				if err != nil {
					log.Errorf("error: %v", err)
					return err
				}
				if _, err := tx.ExecContext(ctx, `
				SET LOCAL app.student_id = ?;
				`, student.ID); err != nil {
					return err
				}
				// rc.JSONSet(ctx, cacheKey, "$.student", &student)
				uc.Student = &student
				uc.Type = string(StudentLearner)
				uc.Role = RoleCustomer
				uc.RoleID = &student.ID
			}
			if customerType == ParentGuardian {
				parent := Parent{
					FirstName:  params.GetFirstName(),
					LastName:   params.GetLastName(),
					Country:    params.GetCountry(),
					Currency:   params.GetCurrency(),
					Language:   params.GetPrimaryLanguage(),
					NumChild:   1,
					CustomerID: customerID,
				}
				_, err = tx.NewInsert().Model(&parent).Exec(ctx)
				if err != nil {
					log.Errorf("error: %v", err)
					return err
				}
				if _, err := tx.ExecContext(ctx, `
				SET LOCAL app.parent_id = ?;
				`, parent.ID); err != nil {
					return err
				}
				uc.Parent = &parent
				uc.Type = string(ParentGuardian)
				uc.Role = RoleCustomer
				uc.RoleID = &parent.ID
			}
		}

		if subId == nil {
			return errors.New("subscription was not created")
		}
		tx.ExecContext(ctx, `
		SET LOCAL app.subscriber_id = ?;
		`, subId)
		status := "pending"
		sub := Subscription{
			// ID:               *subId,
			SubscriberID:     *subId,
			SubscriberType:   uc.Role,
			TenantID:         tenantID,
			Status:           &status,
			UnlockedFeatures: TrialFeatures(),
			TrialActive:      true,
			Plan:             &plan,
		}
		_, err = tx.NewInsert().Model(&sub).Exec(ctx)
		if err != nil {
			return err
		}
		// rc.JSONSet(ctx, cacheKey, "$.sub", &sub)

		uc.Subscription = &sub
		uc.SubscriptionID = &sub.ID
		rc.JSONSet(ctx, cacheKey, "$.data", uc)
		return nil
	}); err != nil {
		log.Errorf("Signup failed: %v", err)
		return nil, err
	}
	return uc, nil
}

func createUsersRLSPolicies(ctx context.Context, db *bun.DB) error {
	return db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		if _, err := tx.ExecContext(ctx, `
		DROP POLICY IF EXISTS "users select own" ON users;
		CREATE POLICY "users select own"
		ON users
		FOR SELECT
		TO authenticated
		USING (
			--true
			pid = NULLIF(current_setting('app.pid', true), '')::uuid OR
			id = NULLIF(current_setting('app.user_id', true), '')::uuid
		);
		`); err != nil {
			log.Errorf("Failed to create policies")
			return err
		}

		if _, err := tx.ExecContext(ctx, `
		DROP POLICY IF EXISTS "users update own" ON users;
		CREATE POLICY "users update own"
		ON users
		FOR UPDATE
		TO authenticated
		USING (id = current_setting('app.user_id', true)::uuid)
		WITH CHECK (
			id = current_setting('app.user_id', true)::uuid
		)
		`); err != nil {
			log.Errorf("Failed to create policies")
			return err
		}

		return nil
	})
}

func alterUsersRLSPolicies(ctx context.Context, db *bun.DB) error {
	return db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		if _, err := tx.ExecContext(ctx, `
		DROP POLICY IF EXISTS "users select own" ON users;
		CREATE POLICY "users select own"
		ON users
		FOR SELECT
		TO authenticated
		USING (
			--true
			--pid = NULLIF(current_setting('app.pid', true), '')::uuid OR
			id = NULLIF(current_setting('app.user_id', true), '')::uuid
		);
		`); err != nil {
			log.Errorf("Failed to create policies")
			return err
		}

		if _, err := tx.ExecContext(ctx, `
		DROP POLICY IF EXISTS "users update own" ON users;
		CREATE POLICY "users update own"
		ON users
		FOR UPDATE
		TO authenticated
		USING (id = current_setting('app.user_id', true)::uuid)
		WITH CHECK (
			id = current_setting('app.user_id', true)::uuid
		)
		`); err != nil {
			log.Errorf("Failed to create policies")
			return err
		}

		return nil
	})
}
