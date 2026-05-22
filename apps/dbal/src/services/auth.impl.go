package services

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"time"

	"github.com/gofiber/fiber/v3/log"
	"github.com/golang-jwt/jwt/v5"
	"github.com/hibiken/asynq"
	"github.com/misterlobo/teachme/src/db"
	"github.com/misterlobo/teachme/src/lib"
	"github.com/misterlobo/teachme/src/models"
	"github.com/misterlobo/teachme/src/utils"
	"github.com/misterlobo/teachme/src/workers"
	"github.com/redis/go-redis/v9"
	"github.com/uptrace/bun"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	authpb "github.com/misterlobo/teachme/generated/v1/auth"
)

type AuthServer struct {
	authpb.UnimplementedAuthServiceServer
}

type AuthSignupValidator struct {
	*authpb.AuthSignup
	Email string `validate:"email" json:"email"`
	// Password string `validate:"min=12" json:"password"`
}

type UserClaims struct {
	jwt.RegisteredClaims
	PID    string            `json:"pid"`
	RoleID string            `json:"role_id"`
	Role   models.UserRole   `json:"role,omitempty"`
	Roles  []models.UserRole `json:"roles,omitempty"`
	Email  string            `json:"email,omitempty"`
}

func generateTokens(userId string, role models.UserRole, roleId string) (string, string, error) {
	claims := UserClaims{
		PID:    userId,
		Role:   models.UserRole(role),
		Roles:  []models.UserRole{role},
		RoleID: roleId,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userId,
			Issuer:    "teachme",
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS512, claims)

	b := make([]byte, 32)
	_, err := rand.Read(b)
	if err != nil {
		return "", "", err
	}
	refreshToken := base64.URLEncoding.EncodeToString(b)

	secretBytes, err := base64.StdEncoding.DecodeString(os.Getenv("JWT_SECRET"))
	tok, err := token.SignedString(secretBytes)
	if err != nil {
		return "", "", err
	}
	return tok, refreshToken, nil
}

func (s *AuthServer) Login(ctx context.Context, in *authpb.AuthLogin) (*authpb.LoginResponse, error) {
	db := db.GetDb()
	user, err := models.FindUserForAuth(ctx, db, in)
	if err != nil {
		log.Errorf("Failed to lookup user: %v", err)
		return &authpb.LoginResponse{
			Status:     "unauthorized",
			StatusCode: 401,
			Error:      utils.StringPtr("bad credentials"),
		}, nil
	}
	log.Infof("user found: %s", user.ID.String())
	ok, err := utils.VerifyPassword(in.GetPassword(), user.Password)
	if !ok {
		return &authpb.LoginResponse{
			Status:     "unauthorized",
			StatusCode: 401,
			Error:      utils.StringPtr("bad credentials"),
		}, nil
	}
	t, r, err := generateTokens(user.Pid.String(), *user.Role, user.Pid.String())
	if err != nil {
		return nil, status.Error(codes.Internal, "could not create token")
	}

	rc := lib.GetRedisClient(ctx)
	_, err = rc.JSONGet(ctx, fmt.Sprintf("%s:discovery:suggestions", user.Pid.String())).Result()
	if err != nil {
		if errors.Is(err, redis.Nil) {
			_, js, err := lib.GetNatsInstance()
			if err != nil {
				log.Fatalf("[eventbus] could not initialize event bus: %v", err)
			}
			marsh, _ := json.Marshal(map[string]any{
				"pid": user.Pid.String(),
				"id":  user.ID.String(),
			})
			_, err = js.PublishAsync("agents.discovery", marsh)
			if err != nil {
				log.Fatalf("[eventBus] could not publish message")
			}
			// log.Infof("[eventBus] message published to %s", ack.Stream)
			marsh, _ = json.Marshal(map[string]any{
				"userId": user.Pid.String(),
				"status": "success",
			})
			if _, err := js.PublishAsync("auth.login", marsh); err != nil {
			}
		} else {
			log.Errorf("[dicovery] error reading from cache: %v", err)
		}
	}
	userKey := &authpb.UserKey{
		KeyCipher: user.SecurityManifest.PrivateKeyCipher,
		PublicKey: user.SecurityManifest.PublicKey,
		Salt:      user.SecurityManifest.Salt,
		MasterKey: &authpb.UserKey_MasterKey{
			WrappedCipher: user.SecurityManifest.MasterKeyCipher,
			Iv:            user.SecurityManifest.MasterKeyIV,
		},
	}
	log.Infof("[AUTH] keys: %v", userKey)
	rc.JSONSet(ctx, fmt.Sprintf("%s:keys", user.Pid), "$", userKey)

	return &authpb.LoginResponse{
		AccessToken:  &t,
		RefreshToken: &r,
		Status:       "OK",
		StatusCode:   200,
		Keys:         userKey,
	}, nil
}

func (s *AuthServer) Signup(ctx context.Context, in *authpb.AuthSignup) (*authpb.SignupResponse, error) {
	task := ctx.Value("task")
	if task == nil {
		log.Fatal("task service not initialized\n")
	}
	/* if err := validator.New(validator.WithRequiredStructEnabled()).Struct(AuthSignupValidator{AuthSignup: in}); err != nil {
		log.Errorf("Validation failed: %v", err)
		return nil, status.Error(codes.InvalidArgument, "unprocessable entity")
	} */
	if in.GetPlan() != "" {
		return registerWithSubscription(ctx, in)
	}
	err := models.CreateUserWithPassword(ctx, in)
	if err != nil {
		log.Errorf("[Signup] error creating user: %v\n", err)
		return nil, status.Error(codes.Internal, "internal error")
	}
	return &authpb.SignupResponse{
		Status: "success",
	}, nil
}

func registerWithSubscription(ctx context.Context, p *authpb.AuthSignup) (*authpb.SignupResponse, error) {
	uc, err := models.CreateUserWithPasswordAndSubscription(ctx, p)
	if err != nil {
		log.Errorf("[Signup] error creating user: %v\n", err)
		return nil, status.Error(codes.InvalidArgument, "bad request")
	}
	log.Infof("user created: %v\n", uc)
	rc := lib.GetRedisClient(ctx)
	stateCacheKey := fmt.Sprintf("worker:{%s}:status", uc.PID)
	rc.Set(ctx, stateCacheKey, "CREATED", 0)
	tc := lib.GetTaskClient()
	defer tc.Close()
	t, _, err := generateTokens(uc.PID.String(), uc.Role, uc.PID.String())
	if err != nil {
		return nil, status.Error(codes.Internal, "could not create token")
	}
	rc.Set(ctx, fmt.Sprintf("%s:auth:token", uc.PID), t, 0)

	scustPayload, err := json.Marshal(workers.StripeCustomerCreateWorkerArgs{
		User: *uc,
	})
	if err != nil {
		log.Errorf("error starting worker: %s", workers.StripeCustomersCreate)
		return nil, status.Error(codes.Internal, "internal error")
	}
	scustTask := asynq.NewTask(workers.StripeCustomersCreate, scustPayload)
	_, err = tc.Enqueue(scustTask, asynq.Queue("critical"))
	if err != nil {
		log.Errorf("[auth] could not enqueue task: %v", err)
		return nil, status.Error(codes.Internal, "internal error")
	}

	if uc.Type == string(models.TutorIndividual) {
		payload, err := json.Marshal(workers.StripeAccountsCreateWorkerArgs{
			User: *uc,
		})
		if err != nil {
			log.Errorf("error starting worker: %s", workers.StripeAccountsCreate)
			return nil, status.Error(codes.Internal, "internal error")
		}
		task := asynq.NewTask(workers.StripeAccountsCreate, payload)
		_, err = tc.Enqueue(task, asynq.Queue("critical"))
		if err != nil {
			log.Errorf("[StripeAccountsCreate] could not enqueue task: %v", err)
			return nil, status.Error(codes.Internal, "internal error")
		}

		log.Infof("STATE CACHE KEY: -------------------------------------> %s <-------------------------------------", stateCacheKey)
		embedPayload, err := json.Marshal(workers.TutorEmbeddingCreateWorkerArgs{
			User:          *uc,
			StateCacheKey: stateCacheKey,
		})
		if err != nil {
			log.Errorf("error starting worker: %s", workers.TutorEmbeddingsCreate)
			return nil, status.Error(codes.Internal, "internal error")
		}
		embedTask := asynq.NewTask(workers.TutorEmbeddingsCreate, embedPayload)
		_, err = tc.Enqueue(embedTask, asynq.Queue("critical"))
		if err != nil {
			log.Errorf("[TutorEmbeddingsCreate] could not enqueue task: %v", err)
			return nil, status.Error(codes.Internal, "internal error")
		}

		calPayload, err := json.Marshal(workers.CalAccountsCreateWorkerArgs{
			User: *uc,
		})
		if err != nil {
			log.Errorf("error starting worker: %s", workers.CalAccountsCreate)
			return nil, status.Error(codes.Internal, "internal error")
		}
		calTask := asynq.NewTask(workers.CalAccountsCreate, calPayload)
		_, err = tc.Enqueue(calTask, asynq.Queue("critical"))
		if err != nil {
			log.Errorf("[CalAccountsCreate] could not enqueue task: %v", err)
			return nil, status.Error(codes.Internal, "internal error")
		}
	}
	return &authpb.SignupResponse{
		Status: "success",
		Id:     utils.StringPtr(uc.PID.String()),
	}, nil
}

func (s *AuthServer) VerifyPassword(ctx context.Context, in *authpb.AuthVerifyPasswordRequest) (*authpb.AuthVerifyPasswordResponse, error) {
	pid := ctx.Value("pid")
	var user models.User
	db := db.GetDb()
	if err := db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		if _, err := tx.ExecContext(ctx, `
			SELECT set_rls_context(?);
		`, pid); err != nil {
			return err
		}
		sid, err := models.GetTxSession(ctx, &tx)
		if err != nil {
			return err
		}
		log.Infof("TxSessionID: %#v", sid)
		tx.ExecContext(ctx, `
			SET LOCAL app.user_id = ?;
		`, sid.UserID)
		if err := tx.NewSelect().
			Model(&models.User{}).
			Column("id", "password").
			Where("id = ?", sid.UserID).
			Scan(ctx, &user); err != nil {
		}
		return nil
	}); err != nil {
		log.Errorf("Failed to lookup user: %v", err)
		return &authpb.AuthVerifyPasswordResponse{
			Status:     "unauthorized",
			StatusCode: 401,
			Error:      utils.StringPtr("bad credentials"),
		}, nil
	}
	log.Infof("user found: %s", user.ID.String())
	ok, err := utils.VerifyPassword(in.GetPassword(), user.Password)
	if err != nil {
		log.Errorf("[AUTH] could not verify password: %v", err)
		return nil, status.Error(codes.Aborted, "bad credentials")
	}
	if !ok {
		return &authpb.AuthVerifyPasswordResponse{
			Status:     "unauthorized",
			StatusCode: 401,
			Error:      utils.StringPtr("bad credentials"),
		}, nil
	}

	return &authpb.AuthVerifyPasswordResponse{
		Status:     "success",
		StatusCode: 200,
	}, nil
}
