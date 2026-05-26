package services

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/bytemare/opaque"
	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/webauthn"
	"github.com/gofiber/fiber/v3/log"
	"github.com/google/uuid"
	credpb "github.com/misterlobo/teachme/generated/v1/credential"
	"github.com/misterlobo/teachme/src/db"
	"github.com/misterlobo/teachme/src/lib"
	"github.com/misterlobo/teachme/src/models"
	"github.com/misterlobo/teachme/src/utils"
	"github.com/sony/gobreaker/v2"
	"github.com/uptrace/bun"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"
)

type CredentialServer struct {
	credpb.UnimplementedCredentialServiceServer
	server        *opaque.Server
	serverID      string
	skm           *opaque.ServerKeyMaterial
	records       map[string]*opaque.ClientRecord
	serverSetup   string
	isServerSetup bool
}

func getWebauthn() (*webauthn.WebAuthn, error) {
	return webauthn.New(&webauthn.Config{
		RPID:          "localhost",
		RPDisplayName: "TeachMe",
		RPOrigins: []string{
			"https://localhost:3005",
			"https://localhost:7891",
		},
		AuthenticatorSelection: protocol.AuthenticatorSelection{
			// AuthenticatorAttachment: protocol.CrossPlatform,
			RequireResidentKey: protocol.ResidentKeyNotRequired(),
			UserVerification:   protocol.VerificationRequired,
			ResidentKey:        protocol.ResidentKeyRequirementPreferred,
		},
		AttestationPreference: protocol.PreferNoAttestation,
		Debug:                 true,
		Timeouts: webauthn.TimeoutsConfig{
			Registration: webauthn.TimeoutConfig{
				Timeout: 60 * time.Second,
				Enforce: true,
			},
			Login: webauthn.TimeoutConfig{
				Timeout: 60 * time.Second,
				Enforce: true,
			},
		},
	})
}

type WebauthnUser struct {
	Inner       *models.User
	Credentials []webauthn.Credential
}

func (u *WebauthnUser) WebAuthnID() []byte                         { return []byte(u.Inner.ID.String()) }
func (u *WebauthnUser) WebAuthnName() string                       { return u.Inner.Email }
func (u *WebauthnUser) WebAuthnDisplayName() string                { return u.Inner.Name }
func (u *WebauthnUser) WebAuthnCredentials() []webauthn.Credential { return u.Credentials }

func (s *CredentialServer) StoreDevice(ctx context.Context, in *credpb.CredentialStoreDeviceParams) (*credpb.CredentialResponse, error) {
	return &credpb.CredentialResponse{
		Status:     "OK",
		StatusCode: 200,
	}, nil
}

func (s *CredentialServer) RetrieveDevice(ctx context.Context, in *credpb.CredentialRetrieveDeviceParams) (*credpb.CredentialResponse, error) {
	return &credpb.CredentialResponse{
		Status:     "OK",
		StatusCode: 200,
	}, nil
}

func (s *CredentialServer) ListDevices(ctx context.Context, in *credpb.CredentialListDevicesParams) (*credpb.CredentialResponse, error) {
	return &credpb.CredentialResponse{
		Status:     "OK",
		StatusCode: 200,
	}, nil
}

func (s *CredentialServer) StoreKeys(ctx context.Context, in *credpb.CredentialStoreKeysParams) (*credpb.CredentialResponse, error) {
	log.Infof("[CREDS] received keys: %v", in)
	pid := ctx.Value("pid")
	log.Infof("[CREDS] pid: %v", pid)
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

		uid, _ := uuid.Parse(sid.UserID)

		exists, err := tx.NewSelect().
			Model(&models.UserKey{}).
			Where("user_id = ?", uid).
			Where("credential_id = ?", in.CredentialId).
			Exists(ctx)
		if err != nil {
			log.Errorf("[CREDS] error reading row for UserKey: %v", err)
			return err
		}
		if exists {
			log.Error("[CREDS] key already exists")
			return nil
		}

		if _, err := tx.NewInsert().
			Model(&models.UserKey{
				KeyType:           in.KeyType,
				UserID:            uid,
				CredentialId:      in.CredentialId,
				EncodedCipherBlob: utils.StringPtr(base64.RawURLEncoding.EncodeToString(in.EncodedBlob)),
			}).
			Exec(ctx); err != nil {
			log.Errorf("[CREDS] could not write new row for UserKey: %v", err)
			return err
		}
		return nil
	}); err != nil {
		return nil, status.Error(codes.PermissionDenied, "access denied")
	}
	return &credpb.CredentialResponse{
		Status:     "OK",
		StatusCode: 200,
	}, nil
}

func (s *CredentialServer) SaveKey(ctx context.Context, in *credpb.CredentialStoreKeysParams) (*credpb.CredentialResponse, error) {
	log.Infof("[CREDS] received keys: %v", in)
	pid := ctx.Value("pid")
	log.Infof("[CREDS] pid: %v", pid)
	log.Infof("[CREDS] input PublicKey: %d bytes", len(in.PublicKey))
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

		uid, _ := uuid.Parse(sid.UserID)

		exists, err := tx.NewSelect().
			Model(&models.UserKey{}).
			Where("user_id = ?", uid).
			Where("credential_id = ?", in.CredentialId).
			Exists(ctx)
		if err != nil {
			log.Errorf("[CREDS] error reading row for UserKey: %v", err)
			return err
		}
		if exists {
			log.Error("[CREDS] key already exists")
			return nil
		}

		if _, err := tx.NewInsert().
			Model(&models.UserKey{
				KeyType:           in.KeyType,
				UserID:            uid,
				CredentialId:      in.CredentialId,
				PublicKey:         in.PublicKey,
				Salt:              in.Salt,
				EncodedCipherBlob: new(base64.RawURLEncoding.EncodeToString(in.EncodedBlob)),
			}).
			Exec(ctx); err != nil {
			log.Errorf("[CREDS] could not write new row for UserKey: %v", err)
			return err
		}
		return nil
	}); err != nil {
		return nil, status.Error(codes.PermissionDenied, "access denied")
	}
	return &credpb.CredentialResponse{
		Status:     "OK",
		StatusCode: 200,
	}, nil
}

func (s *CredentialServer) RetrieveKeys(ctx context.Context, in *credpb.CredentialRetrieveKeysParams) (*credpb.CredentialResponse, error) {
	return &credpb.CredentialResponse{
		Status:     "OK",
		StatusCode: 200,
	}, nil
}

func (s *CredentialServer) RegisterBegin(ctx context.Context, in *emptypb.Empty) (*credpb.CredentialRegisterBeginResponse, error) {
	pid := ctx.Value("pid")
	uid, ok := pid.(uuid.UUID)
	if !ok {
		return nil, status.Error(codes.Unauthenticated, "missing PID")
	}
	challenge := make([]byte, 32)
	rand.Read(challenge)

	chal := base64.RawStdEncoding.EncodeToString(challenge)
	rc := lib.GetRedisClient(ctx)
	rc.Set(ctx, fmt.Sprintf("%s:credentials:webauthn:challenge", uid), chal, 5*time.Minute)

	db := db.GetDb()
	var user models.User
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
			Where("id = ?", sid.UserID).
			Scan(ctx, &user); err != nil {
			log.Errorf("[CRED] could not retrieve user info: %v", err)
			return errors.New("not found")
		}
		return nil
	}); err != nil {
		return nil, status.Error(codes.NotFound, err.Error())
	}
	wuser := &WebauthnUser{
		Inner: &user,
	}
	log.Infof("[CRED] wuser: %s %s", wuser.WebAuthnName(), wuser.WebAuthnID())
	wa, err := getWebauthn()
	if err != nil {
		return nil, status.Error(codes.Internal, "could not initialize WebAuthn")
	}
	opts, sessionData, err := wa.BeginRegistration(
		wuser,
		webauthn.WithExtensions(protocol.AuthenticationExtensions{
			"prf":              map[string]any{},
			"hmacCreateSecret": true,
		}),
	)
	if err != nil {
		log.Errorf("[CRED] failed to begin registration: %v", err)
		return nil, status.Error(codes.Internal, "something went wrong")
	}
	log.Infof("[CRED] response opts: %#v", opts.Response)
	log.Infof("[CRED] response opts: %#v", sessionData)
	sessionID := uuid.NewString()
	sessionBytes, _ := json.Marshal(sessionData)
	cacheKey := fmt.Sprintf("%s:webauthn-session:%s", pid, sessionID)
	if err := rc.JSONSet(ctx, cacheKey, "$", sessionBytes).Err(); err != nil {
		log.Errorf("[CRED] could not cache session: %v", err)
		return nil, status.Errorf(codes.Internal, "failed to cache session")
	}
	rc.Expire(ctx, cacheKey, 60*time.Second)

	optionsJSON, _ := json.Marshal(opts)

	return &credpb.CredentialRegisterBeginResponse{
		OptionsJson: optionsJSON,
		SessionId:   sessionID,
		Challenge:   challenge,
	}, nil
}

func (s *CredentialServer) RegisterFinish(ctx context.Context, in *credpb.CredentialRegisterFinishRequest) (*credpb.CredentialRegisterFinishResponse, error) {
	pid := ctx.Value("pid")
	_, ok := pid.(uuid.UUID)
	if !ok {
		return nil, status.Error(codes.Unauthenticated, "missing PID")
	}
	rc := lib.GetRedisClient(ctx)

	val, err := rc.JSONGet(ctx, fmt.Sprintf("%s:webauthn-session:%s", pid, in.GetSessionId())).Result()
	if err != nil {
		log.Errorf("[CRED] error reading session cache: %v", err)
		return nil, status.Errorf(codes.InvalidArgument, "invalid session")
	}
	var sessionData webauthn.SessionData
	json.Unmarshal([]byte(val), &sessionData)

	parsedResponse, err := protocol.ParseCredentialCreationResponseBytes(in.Response)
	if err != nil {
		log.Errorf("[CRED] error parsing response credential: %v", err)
		return nil, status.Errorf(codes.InvalidArgument, "failed to parse credential")
	}
	log.Infof("[CRED] parsedResponse: %#v", parsedResponse)

	wa, err := getWebauthn()
	if err != nil {
		log.Errorf("[CRED] could not initialize WebAuthn: %v", err)
		return nil, status.Error(codes.Internal, "could not initialize WebAuthn")
	}

	db := db.GetDb()
	var user models.User
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
		if err := tx.NewSelect().Model(&models.User{}).Where("id = ?", sid.UserID).Scan(ctx, &user); err != nil {
			log.Errorf("[CREDENTIAL] could not retrieve user info: %v", err)
			return errors.New("not found")
		}
		return nil
	}); err != nil {
		return nil, status.Error(codes.NotFound, err.Error())
	}
	wuser := &WebauthnUser{
		Inner: &user,
	}

	credential, err := wa.CreateCredential(wuser, sessionData, parsedResponse)
	if err != nil {
		return nil, status.Errorf(codes.Unauthenticated, "verification failed")
	}

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
		uid, _ := uuid.Parse(sid.UserID)
		prfSalt := make([]byte, 32)
		rand.Read(prfSalt)

		recTags := make([]*models.RecoveryTag, 0)
		for _, rt := range in.MasterKeys {
			tag := base64.RawURLEncoding.EncodeToString(rt.GetRecoveryTag())
			emk := base64.RawURLEncoding.EncodeToString(rt.GetCipher())
			iv := base64.RawURLEncoding.EncodeToString(rt.GetIv())
			dTag, _ := base64.RawURLEncoding.DecodeString(tag)
			dEmk, _ := base64.RawURLEncoding.DecodeString(emk)
			dIV, _ := base64.RawURLEncoding.DecodeString(iv)
			recTags = append(recTags, &models.RecoveryTag{
				Tag:          dTag,
				EncMasterKey: dEmk,
				IV:           dIV,
			})
		}
		mcreds, _ := json.Marshal(credential)
		device := &models.Device{
			UserID: uid,
			EncMasterKey: &models.WrappedMasterKey{
				Cipher: in.EncMk,
				IV:     in.MkIv,
			},
			PublicKey:      base64.RawURLEncoding.EncodeToString(credential.PublicKey),
			Revoked:        false,
			PrfSalt:        base64.RawURLEncoding.EncodeToString(prfSalt),
			CredentialId:   credential.Descriptor().CredentialID.String(),
			CredentialType: string(credential.Descriptor().Type),
			Credential:     mcreds,
			RecoveryTags:   recTags,
		}
		if _, err := tx.NewInsert().Model(device).Exec(ctx); err != nil {
			return err
		}
		return nil
	}); err != nil {
		log.Errorf("[CRED] DB transaction failed: %v", err)
		return nil, status.Error(codes.Aborted, "aborted")
	}

	return &credpb.CredentialRegisterFinishResponse{
		Success:      false,
		CredentialId: base64.RawURLEncoding.EncodeToString(credential.ID),
	}, nil
}

func (s *CredentialServer) LoginBegin(ctx context.Context, in *credpb.CredentialLoginBeginRequest) (*credpb.CredentialLoginBeginResponse, error) {
	db := db.GetDb()
	users := make([]models.User, 0)
	if err := db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		tx.ExecContext(ctx, `
			SET LOCAL ROLE service_role;
		`)
		if err := tx.NewSelect().
			Model(&users).
			Relation("Devices").
			Where("email = ?", in.GetEmail()).
			Scan(ctx); err != nil {
			log.Errorf("[CREDENTIAL] could not retrieve user info: %v", err)
			return errors.New("not found")
		}
		return nil
	}); err != nil {
		return nil, status.Error(codes.NotFound, err.Error())
	}
	log.Infof("[CRED] %d users", len(users))
	user := users[0]
	wuser := &WebauthnUser{
		Inner:       &user,
		Credentials: []webauthn.Credential{},
	}
	for _, d := range user.Devices {
		credId, _ := base64.RawURLEncoding.DecodeString(d.CredentialId)
		pubKey, _ := base64.RawURLEncoding.DecodeString(d.PublicKey)
		wuser.Credentials = append(wuser.Credentials, webauthn.Credential{
			ID:        credId,
			PublicKey: pubKey,
		})
	}
	log.Infof("[CRED] user has %d devices", len(user.Devices))
	if len(user.Devices) == 0 {
		return nil, status.Error(codes.InvalidArgument, "no credentials registered")
	}

	rc := lib.GetRedisClient(ctx)

	wa, _ := getWebauthn()

	opts, sessionData, err := wa.BeginLogin(wuser)
	if err != nil {
		log.Errorf("[CRED] failed to begin login: %v", err)
		return nil, status.Error(codes.Internal, "something went wrong")
	}
	optionsJSON, _ := json.Marshal(opts)
	sessionID := uuid.NewString()
	cacheKey := fmt.Sprintf("%s:webauthn-login", sessionID)
	rc.JSONSet(ctx, cacheKey, "$", sessionData)
	rc.Expire(ctx, cacheKey, 60*time.Second)
	userCacheKey := fmt.Sprintf("%s:webauthn-login:user", sessionID)
	rc.JSONSet(ctx, userCacheKey, "$", wuser)
	rc.Expire(ctx, cacheKey, 60*time.Second)

	challenge := make([]byte, 32)
	rand.Read(challenge)
	return &credpb.CredentialLoginBeginResponse{
		Challenge:   base64.RawURLEncoding.EncodeToString(opts.Response.Challenge),
		OptionsJson: optionsJSON,
		RpId:        "localhost",
		SessionId:   sessionID,
	}, nil
}

func (s *CredentialServer) LoginFinish(ctx context.Context, in *credpb.CredentialLoginFinishRequest) (*credpb.CredentialLoginFinishResponse, error) {
	rc := lib.GetRedisClient(ctx)
	val, err := rc.JSONGet(ctx, fmt.Sprintf("%s:webauthn-login", in.GetSessionId())).Result()
	if err != nil {
		log.Errorf("[CRED] error retrieving session: %v", err)
		return nil, status.Error(codes.Unauthenticated, "session expired")
	}
	var sessionData webauthn.SessionData
	if err := json.Unmarshal([]byte(val), &sessionData); err != nil {
		log.Errorf("[CRED] error deserializing session: %v", err)
		return nil, status.Error(codes.Aborted, "aborted")
	}
	log.Infof("[CRED] login session: %#v", sessionData)

	uval, err := rc.JSONGet(ctx, fmt.Sprintf("%s:webauthn-login:user", in.GetSessionId())).Result()
	if err != nil {
		log.Errorf("[CRED] error retrieving user: %v", err)
		return nil, status.Error(codes.Unauthenticated, "session expired")
	}
	var wuser WebauthnUser
	if err := json.Unmarshal([]byte(uval), &wuser); err != nil {
		log.Errorf("[CRED] error deserializing user: %v", err)
		return nil, status.Error(codes.Aborted, "aborted")
	}
	log.Infof("[CRED] login wuser: %#v", wuser)

	log.Infof("[CRED] response has %d bytes", len(in.Response))
	parsedResponse, err := protocol.ParseCredentialRequestResponseBytes(in.Response)
	if err != nil {
		log.Errorf("[CRED] invalid response: %v", err)
		return nil, status.Error(codes.InvalidArgument, "invalid response")
	}
	// log.Infof("[CRED] login parsedResponse: %v", parsedResponse)

	wa, _ := getWebauthn()
	credential, err := wa.ValidateLogin(&wuser, sessionData, parsedResponse)
	if err != nil {
		log.Errorf("[CRED] error validating response: %v", err)
		return nil, status.Error(codes.InvalidArgument, "validation failed")
	}
	log.Infof("[CRED] validated credential: %#v", credential)
	var cred *webauthn.Credential
	for _, c := range wuser.Credentials {
		if base64.RawURLEncoding.EncodeToString(c.ID) == base64.RawURLEncoding.EncodeToString(credential.ID) {
			cred = &c
			break
		}
	}

	var dev *models.Device
	for _, d := range wuser.Inner.Devices {
		if d.CredentialId == base64.RawURLEncoding.EncodeToString(cred.ID) {
			dev = d
			break
		}
	}

	marsh, _ := json.Marshal(dev.RecoveryTags)

	return &credpb.CredentialLoginFinishResponse{
		Success:      true,
		Message:      "success",
		EncMk:        []byte(dev.RecoveryTags[0].EncMasterKey),
		PrfSalt:      []byte(dev.PrfSalt),
		RecoveryTags: marsh,
	}, nil
}

func initServer(s *CredentialServer) error {
	conf := opaque.DefaultConfiguration()
	ksfParams := conf.KSF.DefaultParameters()
	log.Infof("[OPAQUE] ksfParams: %v", ksfParams)
	// conf.Context = []byte("context")
	serverPrivateKey, serverPublicKey := conf.KeyGen()
	// svr, _ := opaque.NewServer(conf)
	svr, err := conf.Server()
	if err != nil {
		log.Fatalf("[OPAQUE] failed to init server: %v", err)
	}
	s.server = svr
	s.serverID = "server"
	s.records = make(map[string]*opaque.ClientRecord)
	skm := &opaque.ServerKeyMaterial{
		Identity:       []byte("server"),
		PrivateKey:     serverPrivateKey,
		PublicKeyBytes: serverPublicKey.Encode(),
		OPRFGlobalSeed: conf.GenerateOPRFSeed(),
	}
	if err := svr.SetKeyMaterial(skm); err != nil {
		log.Errorf("[OPAQUE] error on setting key material: %v", err)
		return status.Error(codes.Internal, "internal error")
	}
	s.skm = skm
	return nil
}

func (s *CredentialServer) OpaqueRegisterBegin(ctx context.Context, in *credpb.OpaqueRegisterBeginRequest) (*credpb.OpaqueRegisterBeginResponse, error) {
	pid := ctx.Value("pid")
	uid, _ := pid.(uuid.UUID)

	tlsConf, err := utils.GetTLSConfig()
	creds := credentials.NewTLS(tlsConf)
	if err != nil {
		log.Fatalf("failed to create credentials: %v", err)
	}
	retryPolicy := `{
	"methodConfig": [{
	  "name": [{"service": "core.v1.credential.OpaqueRegisterBegin"}],
	  "retryPolicy": {
		  "MaxAttempts": 4,
		  "InitialBackoff": ".01s",
		  "MaxBackoff": ".01s",
		  "BackoffMultiplier": 1.0,
		  "RetryableStatusCodes": [ "UNAVAILABLE" ]
	  }
	}]}`
	conn, err := grpc.NewClient(
		"localhost:25567",
		grpc.WithTransportCredentials(creds),
		grpc.WithDefaultServiceConfig(retryPolicy),
	)
	if err != nil {
		log.Errorf("did not connect: %v", err)
	}
	defer func() {
		if e := conn.Close(); e != nil {
			log.Errorf("failed to close connection: %s", e)
		}
	}()

	cb := gobreaker.NewCircuitBreaker[*credpb.OpaqueRegisterBeginResponse](gobreaker.Settings{
		Name:        "CredentialService",
		MaxRequests: 3,
		Interval:    10 * time.Second,
		Timeout:     30 * time.Second,
		ReadyToTrip: func(counts gobreaker.Counts) bool {
			failRatio := float64(counts.TotalFailures) / float64(counts.Requests)
			return counts.Requests >= 5 && failRatio >= 0.5
		},
	})

	cli := credpb.NewCredentialServiceClient(conn)

	log.Infof("input: %v", in)
	token := ctx.Value("token")
	reply, err := cb.Execute(func() (*credpb.OpaqueRegisterBeginResponse, error) {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
		defer cancel()

		log.Infof("AUTH TOKEN: %s", token)
		md := metadata.Pairs(
			"authorization", fmt.Sprintf("Bearer %s", token),
			"x-user-pid", uid.String(),
		)
		ctx = metadata.NewOutgoingContext(ctx, md)

		reply, err := cli.OpaqueRegisterBegin(ctx, in)
		if err != nil {
			log.Errorf("Search returned error: %v", err)
			st, _ := status.FromError(err)
			if st.Code() == codes.InvalidArgument {
				return nil, err
			}
			return nil, err
		}

		return reply, nil
	})
	if err != nil {
		log.Errorf("Search returned error: %v", err)
		return nil, err
	}
	log.Infof("[OPAQUE] OpaqueRegisterBegin response: %v", reply)
	/* if !s.isServerSetup {
		s.isServerSetup = true
		s.serverSetup = base64.RawURLEncoding.EncodeToString(reply.ServerSetup)
	} */
	return reply, nil
}

/* func (s *CredentialServer) opaqueRegisterBegin(ctx context.Context, in *credpb.OpaqueRegisterBeginRequest) (*credpb.OpaqueRegisterBeginResponse, error) {
	pid := ctx.Value("pid")
	// uid, _ := pid.(uuid.UUID)

	if s.server == nil {
		if err := initServer(s); err != nil {
			return nil, status.Error(codes.Internal, "internal error")
		}
	}

	svr := s.server

	regMessage := in.GetRegistrationRequest()
	request, err := svr.Deserialize.RegistrationRequest(regMessage)
	if err != nil {
		log.Errorf("[OPAQUE] error processing request: %v", err)
		return nil, status.Error(codes.InvalidArgument, "bad input")
	}
	credID := opaque.RandomBytes(64)

	response, err := svr.RegistrationResponse(request, credID, nil)
	if err != nil {
		log.Errorf("[OPAQUE] error creating response: %v", err)
		return nil, status.Error(codes.InvalidArgument, "bada input")
	}

	rc := lib.GetRedisClient(ctx)
	rc.Set(ctx, fmt.Sprintf("%s:opaque:credential-id", pid), base64.RawURLEncoding.EncodeToString(credID), 0)

	message := response.Serialize()
	msg := base64.RawStdEncoding.EncodeToString(message)
	log.Infof("[OPAQUE] serialized response: %d bytes, %s", len(message), msg)

	return &credpb.OpaqueRegisterBeginResponse{
		RegistrationResponse: message,
		ServerSetup:          s.skm.Encode(),
	}, nil
} */

func (s *CredentialServer) OpaqueRegisterFinish(ctx context.Context, in *credpb.OpaqueRegisterFinishRequest) (*credpb.OpaqueRegisterFinishResponse, error) {
	pid := ctx.Value("pid")
	uid, _ := pid.(uuid.UUID)

	tlsConf, err := utils.GetTLSConfig()
	creds := credentials.NewTLS(tlsConf)
	if err != nil {
		log.Fatalf("failed to create credentials: %v", err)
	}
	retryPolicy := `{
	"methodConfig": [{
	  "name": [{"service": "core.v1.credential.OpaqueRegisterFinish"}],
	  "retryPolicy": {
		  "MaxAttempts": 4,
		  "InitialBackoff": ".01s",
		  "MaxBackoff": ".01s",
		  "BackoffMultiplier": 1.0,
		  "RetryableStatusCodes": [ "UNAVAILABLE" ]
	  }
	}]}`
	conn, err := grpc.NewClient(
		"localhost:25567",
		grpc.WithTransportCredentials(creds),
		grpc.WithDefaultServiceConfig(retryPolicy),
	)
	if err != nil {
		log.Errorf("did not connect: %v", err)
	}
	defer func() {
		if e := conn.Close(); e != nil {
			log.Errorf("failed to close connection: %s", e)
		}
	}()

	cb := gobreaker.NewCircuitBreaker[*credpb.OpaqueRegisterFinishResponse](gobreaker.Settings{
		Name:        "CredentialService",
		MaxRequests: 3,
		Interval:    10 * time.Second,
		Timeout:     30 * time.Second,
		ReadyToTrip: func(counts gobreaker.Counts) bool {
			failRatio := float64(counts.TotalFailures) / float64(counts.Requests)
			return counts.Requests >= 5 && failRatio >= 0.5
		},
	})

	cli := credpb.NewCredentialServiceClient(conn)

	log.Infof("input: %v", in)
	token := ctx.Value("token")
	reply, err := cb.Execute(func() (*credpb.OpaqueRegisterFinishResponse, error) {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
		defer cancel()

		log.Infof("AUTH TOKEN: %s", token)
		md := metadata.Pairs(
			"authorization", fmt.Sprintf("Bearer %s", token),
			"x-user-pid", uid.String(),
		)
		ctx = metadata.NewOutgoingContext(ctx, md)

		reply, err := cli.OpaqueRegisterFinish(ctx, in)
		if err != nil {
			log.Errorf("Search returned error: %v", err)
			st, _ := status.FromError(err)
			if st.Code() == codes.InvalidArgument {
				return nil, err
			}
			return nil, err
		}

		return reply, nil
	})
	if err != nil {
		log.Errorf("Search returned error: %v", err)
		return nil, err
	}
	log.Infof("[OPAQUE] OpaqueRegisterFinish response: %v", reply)
	/* if !s.isServerSetup {
		s.isServerSetup = true
		s.serverSetup = base64.RawURLEncoding.EncodeToString(reply.ServerSetup)
	} */
	return reply, nil
}

func (s *CredentialServer) opaqueRegisterFinish(ctx context.Context, in *credpb.OpaqueRegisterFinishRequest) (*credpb.OpaqueRegisterFinishResponse, error) {
	pid := ctx.Value("pid")
	log.Infof("[OPAQUE] pid: %v", pid)
	log.Infof("[OPAQUE] record with %d bytes", len(in.GetRegistrationRecord()))
	record, err := s.server.Deserialize.RegistrationRecord(in.GetRegistrationRecord())
	if err != nil {
		log.Errorf("[OPAQUE] error deserializing record: %v", err)
		return nil, status.Error(codes.Internal, "internal error")
	}
	rc := lib.GetRedisClient(ctx)
	val := rc.Get(ctx, fmt.Sprintf("%s:opaque:credential-id", pid)).Val()
	credID, err := base64.RawURLEncoding.DecodeString(val)
	if err != nil {
		log.Fatalf("[OPAQUE] failed to decode CredentialId: %v", err)
	}
	log.Infof("[OPAQUE] register record: %v", record)
	ser := record.Serialize()
	pubKeyBin, err := record.ClientPublicKey.MarshalBinary()
	if err != nil {
		log.Fatalf("[OPAQUE] failed to marshal ClientPublicKey: %v", err)
	}

	upid, _ := pid.(uuid.UUID)
	pidBin, _ := upid.MarshalBinary()
	// scred := base64.RawURLEncoding.EncodeToString(credID)
	// log.Fatalf("[OPAQUE] key ID: %s", upid.String())
	rec := &opaque.ClientRecord{
		ClientIdentity:       pidBin,
		CredentialIdentifier: credID,
		RegistrationRecord:   record,
	}
	recBin, _ := json.Marshal(rec)
	log.Infof("[OPAQUE] RegistrationRecord: %d bytes", len(ser))
	log.Infof("[OPAQUE] ClientRecord: %d bytes", len(recBin))

	s.records[upid.String()] = rec

	cacheKey := fmt.Sprintf("%s:opaque:record", pid)
	rc.JSONSet(ctx, cacheKey, "$", map[string]any{
		"clientIdentity":       base64.RawURLEncoding.EncodeToString(pidBin),
		"credentialIdentifier": base64.RawURLEncoding.EncodeToString(credID),
		"record":               base64.RawURLEncoding.EncodeToString(ser),
		"element":              base64.RawURLEncoding.EncodeToString(pubKeyBin),
	})
	rc.Expire(ctx, cacheKey, 5*time.Minute)
	return &credpb.OpaqueRegisterFinishResponse{
		Status:     "OK",
		StatusCode: 200,
	}, nil
}

func (s *CredentialServer) OpaqueLoginBegin(ctx context.Context, in *credpb.OpaqueLoginBeginRequest) (*credpb.OpaqueLoginBeginResponse, error) {
	pid := ctx.Value("pid")
	uid, _ := pid.(uuid.UUID)

	tlsConf, err := utils.GetTLSConfig()
	creds := credentials.NewTLS(tlsConf)
	if err != nil {
		log.Fatalf("failed to create credentials: %v", err)
	}
	retryPolicy := `{
	"methodConfig": [{
	  "name": [{"service": "core.v1.credential.OpaqueLoginBegin"}],
	  "retryPolicy": {
		  "MaxAttempts": 4,
		  "InitialBackoff": ".01s",
		  "MaxBackoff": ".01s",
		  "BackoffMultiplier": 1.0,
		  "RetryableStatusCodes": [ "UNAVAILABLE" ]
	  }
	}]}`
	conn, err := grpc.NewClient(
		"localhost:25567",
		grpc.WithTransportCredentials(creds),
		grpc.WithDefaultServiceConfig(retryPolicy),
	)
	if err != nil {
		log.Errorf("did not connect: %v", err)
	}
	defer func() {
		if e := conn.Close(); e != nil {
			log.Errorf("failed to close connection: %s", e)
		}
	}()

	cb := gobreaker.NewCircuitBreaker[*credpb.OpaqueLoginBeginResponse](gobreaker.Settings{
		Name:        "CredentialService",
		MaxRequests: 3,
		Interval:    10 * time.Second,
		Timeout:     30 * time.Second,
		ReadyToTrip: func(counts gobreaker.Counts) bool {
			failRatio := float64(counts.TotalFailures) / float64(counts.Requests)
			return counts.Requests >= 5 && failRatio >= 0.5
		},
	})

	cli := credpb.NewCredentialServiceClient(conn)

	log.Infof("input: %v", in)
	token := ctx.Value("token")
	reply, err := cb.Execute(func() (*credpb.OpaqueLoginBeginResponse, error) {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
		defer cancel()

		log.Infof("AUTH TOKEN: %s", token)
		md := metadata.Pairs(
			"authorization", fmt.Sprintf("Bearer %s", token),
			"x-user-pid", uid.String(),
		)
		ctx = metadata.NewOutgoingContext(ctx, md)

		reply, err := cli.OpaqueLoginBegin(ctx, in)
		if err != nil {
			log.Errorf("Search returned error: %v", err)
			st, _ := status.FromError(err)
			if st.Code() == codes.InvalidArgument {
				return nil, err
			}
			return nil, err
		}

		return reply, nil
	})
	if err != nil {
		log.Errorf("Search returned error: %v", err)
		return nil, err
	}
	log.Infof("[OPAQUE] OpaqueLoginBegin response: %v", reply)
	return reply, nil
}

/* func (s *CredentialServer) opaqueLoginBegin(ctx context.Context, in *credpb.OpaqueLoginBeginRequest) (*credpb.OpaqueLoginBeginResponse, error) {
	pid := ctx.Value("pid")
	uid, _ := pid.(uuid.UUID)

	rc := lib.GetRedisClient(ctx)
	svr := s.server
	ke1, err := svr.Deserialize.KE1(in.StartLoginRequest)
	if err != nil {
		log.Errorf("[OPAQUE] error processing request: %v", err)
		return nil, status.Error(codes.InvalidArgument, "bad input")
	}

	val, err := rc.JSONGet(ctx, fmt.Sprintf("%s:opaque:record", pid)).Result()
	if err != nil {
		log.Errorf("[OPAQUE] error retrieving record: %v", err)
		return nil, status.Error(codes.NotFound, "not found")
	}

	cachedRecord := map[string]any{}
	if err := json.Unmarshal([]byte(val), &cachedRecord); err != nil {
		log.Errorf("[OPAQUE] error parsing record: %v", err)
		return nil, status.Error(codes.Internal, "internal error")
	}
	log.Infof("[OPAQUE] cached: %v", cachedRecord)

	log.Infof("[OPAQUE] records: %d", len(s.records))
	log.Infof("[OPAQUE] ClientIdentity: %s", pid)
	record := s.records[uid.String()]
	recBin, _ := json.Marshal(record)
	log.Infof("[OPAQUE] RegistrationRecord: %d bytes", len(record.Serialize()))
	log.Infof("[OPAQUE] ClientRecord: %d bytes", len(recBin))

	credIDVal := rc.Get(ctx, fmt.Sprintf("%s:opaque:credential-id", pid)).Val()
	log.Infof("[OPAQUE] credIDVal: %s", credIDVal)
	ke2, output, err := svr.GenerateKE2(ke1, record)
	if err != nil {
		log.Errorf("[OPAQUE] error generating KE2: %v", err)
		return nil, status.Error(codes.Internal, "internal error")
	}
	ke2bin := ke2.Serialize()
	log.Infof("[OPAQUE] cMAC=%s secret=%s",
		base64.RawURLEncoding.EncodeToString(output.ClientMAC),
		base64.RawURLEncoding.EncodeToString(output.SessionSecret),
	)

	return &credpb.OpaqueLoginBeginResponse{
		LoginResponse:    ke2bin,
		ServerLoginState: []byte("server.state"),
	}, nil
} */

func (s *CredentialServer) OpaqueLoginFinish(ctx context.Context, in *credpb.OpaqueLoginFinishRequest) (*credpb.OpaqueLoginFinishResponse, error) {
	pid := ctx.Value("pid")
	uid, _ := pid.(uuid.UUID)

	tlsConf, err := utils.GetTLSConfig()
	creds := credentials.NewTLS(tlsConf)
	if err != nil {
		log.Fatalf("failed to create credentials: %v", err)
	}
	retryPolicy := `{
	"methodConfig": [{
	  "name": [{"service": "core.v1.credential.OpaqueLoginFinish"}],
	  "retryPolicy": {
		  "MaxAttempts": 4,
		  "InitialBackoff": ".01s",
		  "MaxBackoff": ".01s",
		  "BackoffMultiplier": 1.0,
		  "RetryableStatusCodes": [ "UNAVAILABLE" ]
	  }
	}]}`
	conn, err := grpc.NewClient(
		"localhost:25567",
		grpc.WithTransportCredentials(creds),
		grpc.WithDefaultServiceConfig(retryPolicy),
	)
	if err != nil {
		log.Errorf("did not connect: %v", err)
	}
	defer func() {
		if e := conn.Close(); e != nil {
			log.Errorf("failed to close connection: %s", e)
		}
	}()

	cb := gobreaker.NewCircuitBreaker[*credpb.OpaqueLoginFinishResponse](gobreaker.Settings{
		Name:        "CredentialService",
		MaxRequests: 3,
		Interval:    10 * time.Second,
		Timeout:     30 * time.Second,
		ReadyToTrip: func(counts gobreaker.Counts) bool {
			failRatio := float64(counts.TotalFailures) / float64(counts.Requests)
			return counts.Requests >= 5 && failRatio >= 0.5
		},
	})

	cli := credpb.NewCredentialServiceClient(conn)

	token := ctx.Value("token")
	reply, err := cb.Execute(func() (*credpb.OpaqueLoginFinishResponse, error) {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
		defer cancel()

		log.Infof("AUTH TOKEN: %s", token)
		md := metadata.Pairs(
			"authorization", fmt.Sprintf("Bearer %s", token),
			"x-user-pid", uid.String(),
		)
		ctx = metadata.NewOutgoingContext(ctx, md)

		reply, err := cli.OpaqueLoginFinish(ctx, in)
		if err != nil {
			log.Errorf("[OPAQUE] LoginFinish returned error: %v", err)
			st, _ := status.FromError(err)
			if st.Code() == codes.InvalidArgument {
				return nil, err
			}
			return nil, err
		}

		return reply, nil
	})
	if err != nil {
		log.Errorf("[OPAQUE] LoginFinish returned error: %v", err)
		return nil, err
	}
	log.Infof("[OPAQUE] OpaqueLoginFinish response: %v", reply)
	return reply, nil
}
