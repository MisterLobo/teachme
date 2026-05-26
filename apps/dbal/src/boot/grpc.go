package boot

import (
	"context"
	"encoding/base64"
	"log/slog"
	"net"
	"os"
	"runtime/debug"
	"strings"

	"github.com/gofiber/fiber/v3/log"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	grpcprom "github.com/grpc-ecosystem/go-grpc-middleware/providers/prometheus"
	"github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors"
	"github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors/logging"
	"github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors/ratelimit"
	"github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors/recovery"
	"github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors/selector"
	grpcmeta "github.com/grpc-ecosystem/go-grpc-middleware/v2/metadata"
	"github.com/grpc-ecosystem/go-grpc-middleware/v2/testing/testpb"
	accountpb "github.com/misterlobo/teachme/generated/v1/account"
	appointmentpb "github.com/misterlobo/teachme/generated/v1/appointment"
	authpb "github.com/misterlobo/teachme/generated/v1/auth"
	bookingpb "github.com/misterlobo/teachme/generated/v1/booking"
	credpb "github.com/misterlobo/teachme/generated/v1/credential"
	paymentpb "github.com/misterlobo/teachme/generated/v1/payment"
	profilepb "github.com/misterlobo/teachme/generated/v1/profile"
	toolpb "github.com/misterlobo/teachme/generated/v1/tool"
	tutorpb "github.com/misterlobo/teachme/generated/v1/tutor"
	"github.com/misterlobo/teachme/src/db"
	"github.com/misterlobo/teachme/src/lib"
	"github.com/misterlobo/teachme/src/services"
	"github.com/misterlobo/teachme/src/utils"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/uptrace/bun"
	"go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials"
	healthpb "google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

var publicMethods = map[string]bool{
	"/v1.auth.AuthService/Login":                   true,
	"/v1.auth.AuthService/Signup":                  true,
	"/v1.credential.CredentialService/LoginBegin":  true,
	"/v1.credential.CredentialService/LoginFinish": true,
	"/v1.credential.CredentialService/StoreKeys":   true,
}

func interceptorLogger(l *slog.Logger) logging.Logger {
	return logging.LoggerFunc(func(ctx context.Context, level logging.Level, msg string, fields ...any) {
		l.Log(ctx, slog.Level(level), msg, fields...)
	})
}

func injectLibsInterceptor(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
	// ctx = InitEventBus(ctx)
	ctx = InitScheduler(ctx)

	asynqclient := InitTaskQueue(ctx)
	ctx = context.WithValue(ctx, "task", asynqclient)

	vault, _ := lib.GetVault(ctx)
	ctx = context.WithValue(ctx, "vault", vault)

	return handler(ctx, req)
}

type alwaysPassLimiter struct{}

func (*alwaysPassLimiter) Limit(_ context.Context) error {
	return nil
}

func StartGrpcServer(ctx context.Context) {
	logger := slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{}))
	rpcLogger := logger.With("service", "gRPC/server", "component", "grpc-example")
	logTraceID := func(ctx context.Context) logging.Fields {
		if span := trace.SpanContextFromContext(ctx); span.IsSampled() {
			return logging.Fields{"traceID", span.TraceID().String()}
		}
		return nil
	}
	logger.Log(ctx, slog.LevelDebug, "testing")

	srvMetrics := grpcprom.NewServerMetrics(
		grpcprom.WithServerHandlingTimeHistogram(
			grpcprom.WithHistogramBuckets([]float64{}),
		),
		grpcprom.WithContextLabels("tenant_name"),
	)
	reg := prometheus.NewRegistry()
	reg.MustRegister(srvMetrics)
	exemplarFromContext := func(ctx context.Context) prometheus.Labels {
		if span := trace.SpanContextFromContext(ctx); span.IsSampled() {
			return prometheus.Labels{"traceID": span.TraceID().String()}
		}
		return nil
	}
	labelsFromContext := func(ctx context.Context) prometheus.Labels {
		labels := prometheus.Labels{}
		md := grpcmeta.ExtractIncoming(ctx)
		tenantName := md.Get("tenant-name")
		if tenantName == "" {
			tenantName = "unknown"
		}
		labels["tenant_name"] = tenantName
		return labels
	}

	allButHealthZ := func(ctx context.Context, callMeta interceptors.CallMeta) bool {
		return authpb.AuthService_ServiceDesc.ServiceName != callMeta.Service ||
			healthpb.Health_ServiceDesc.ServiceName != callMeta.Service
	}
	panicsTotal := promauto.With(reg).NewCounter(prometheus.CounterOpts{
		Name: "yeah",
		Help: "sure",
	})
	grpcPanicRecoveryHandler := func(p any) (err error) {
		panicsTotal.Inc()
		rpcLogger.Error("recovered from panic", "panic", p, "stack", debug.Stack())
		return status.Errorf(codes.Internal, "%s", p)
	}

	tlsConf, err := utils.GetTLSConfig()
	creds := credentials.NewTLS(tlsConf)
	if err != nil {
		log.Fatalf("failed to create credentials: %v", err)
	}
	grpcServer := grpc.NewServer(
		grpc.Creds(creds),
		grpc.StatsHandler(otelgrpc.NewServerHandler()),
		grpc.ChainUnaryInterceptor(
			ratelimit.UnaryServerInterceptor(&alwaysPassLimiter{}),
			srvMetrics.UnaryServerInterceptor(
				grpcprom.WithExemplarFromContext(exemplarFromContext),
				grpcprom.WithLabelsFromContext(labelsFromContext),
			),
			logging.UnaryServerInterceptor(interceptorLogger(rpcLogger), logging.WithFieldsFromContext(logTraceID)),
			selector.UnaryServerInterceptor(authInterceptor, selector.MatchFunc(allButHealthZ)),
			recovery.UnaryServerInterceptor(
				recovery.WithRecoveryHandler(grpcPanicRecoveryHandler),
			),
			grpc.UnaryServerInterceptor(subscriptionPlanInterceptor),
			grpc.UnaryServerInterceptor(unlockedFeaturesInterceptor),
			grpc.UnaryServerInterceptor(creditsInterceptor),
			grpc.UnaryServerInterceptor(featureFlagsInterceptor),
			grpc.UnaryServerInterceptor(injectLibsInterceptor),
		),
		grpc.ChainStreamInterceptor(
			srvMetrics.StreamServerInterceptor(
				grpcprom.WithExemplarFromContext(exemplarFromContext),
				grpcprom.WithLabelsFromContext(labelsFromContext),
			),
			logging.StreamServerInterceptor(interceptorLogger(rpcLogger), logging.WithFieldsFromContext(logTraceID)),
			recovery.StreamServerInterceptor(
				recovery.WithRecoveryHandler(grpcPanicRecoveryHandler),
			),
		),
	)
	t := &testpb.TestPingService{}
	testpb.RegisterTestServiceServer(grpcServer, t)
	srvMetrics.InitializeMetrics(grpcServer)
	authpb.RegisterAuthServiceServer(grpcServer, &services.AuthServer{})
	bookingpb.RegisterBookingServiceServer(grpcServer, &services.BookingServer{})
	tutorpb.RegisterTutorServiceServer(grpcServer, &services.TutorServer{})
	profilepb.RegisterProfileServiceServer(grpcServer, &services.ProfileServer{})
	accountpb.RegisterAccountServiceServer(grpcServer, &services.AccountServer{})
	paymentpb.RegisterPaymentServiceServer(grpcServer, &services.PaymentServer{AccountServer: &services.AccountServer{}})
	appointmentpb.RegisterAppointmentServiceServer(grpcServer, &services.AppointmentServer{})
	toolpb.RegisterToolServiceServer(grpcServer, &services.ToolServer{ProfileServer: &services.ProfileServer{}})
	credpb.RegisterCredentialServiceServer(grpcServer, &services.CredentialServer{})

	lis, err := net.Listen("tcp", ":7891")
	if err != nil {
		log.Fatal(err)
	}
	log.Infof("gRPC server running on :7891\n")
	grpcServer.Serve(lis)
}

func subscriptionPlanInterceptor(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
	publicMethod := publicMethods[info.FullMethod]
	log.Info(info.FullMethod, publicMethod)
	if publicMethods[info.FullMethod] {
		return handler(ctx, req)
	}
	return handler(ctx, req)
}

func unlockedFeaturesInterceptor(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
	publicMethod := publicMethods[info.FullMethod]
	log.Info(info.FullMethod, publicMethod)
	if publicMethods[info.FullMethod] {
		return handler(ctx, req)
	}
	return handler(ctx, req)
}

func creditsInterceptor(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
	publicMethod := publicMethods[info.FullMethod]
	log.Info(info.FullMethod, publicMethod)
	if publicMethods[info.FullMethod] {
		return handler(ctx, req)
	}
	return handler(ctx, req)
}

func featureFlagsInterceptor(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
	publicMethod := publicMethods[info.FullMethod]
	log.Info(info.FullMethod, publicMethod)
	if publicMethods[info.FullMethod] {
		return handler(ctx, req)
	}
	return handler(ctx, req)
}

func authInterceptor(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
	publicMethod := publicMethods[info.FullMethod]
	log.Info(info.FullMethod, publicMethod)
	if publicMethods[info.FullMethod] {
		return handler(ctx, req)
	}

	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return nil, status.Error(codes.Canceled, "missing metadata")
	}
	authHeader := md["authorization"]
	if len(authHeader) == 0 {
		return nil, status.Error(codes.Canceled, "missing token")
	}

	tokenStr := strings.TrimPrefix(authHeader[0], "Bearer ")
	if tokenStr == authHeader[0] {
		return nil, status.Error(codes.Unauthenticated, "invalid authorization format")
	}

	claims := services.UserClaims{}

	parser := jwt.NewParser(
		jwt.WithValidMethods([]string{jwt.SigningMethodHS512.Alg()}),
		jwt.WithExpirationRequired(),
	)
	log.Infof("tokenStr: %s", tokenStr)
	token, err := parser.ParseWithClaims(tokenStr, &claims, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, status.Error(codes.Unauthenticated, "unexpected signing method")
		}
		return base64.StdEncoding.DecodeString(os.Getenv("JWT_SECRET"))
		// return []byte(os.Getenv("JWT_SECRET")), nil
	})

	if err != nil || !token.Valid {
		log.Errorf("authentication error: %v", err)
		return nil, status.Error(codes.Unauthenticated, "invalid token")
	}

	log.Infof("extracting PID: %s", claims.PID)
	pid, err := uuid.Parse(claims.PID)
	if err != nil {
		log.Errorf("[AUTH] failed to parse PID: %v", err)
		return nil, status.Error(codes.PermissionDenied, "invalid session")
	}
	ctx = context.WithValue(ctx, "pid", pid)
	ctx = context.WithValue(ctx, "PID", claims.PID)
	ctx = context.WithValue(ctx, "roles", claims.Roles)
	ctx = context.WithValue(ctx, "role_id", claims.RoleID)
	ctx = context.WithValue(ctx, "token", tokenStr)
	ctx = context.WithValue(ctx, "claims", claims)

	db := db.GetDb()
	if err := db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		if _, err := tx.ExecContext(ctx, `
			SELECT set_rls_context(?);
		`, pid); err != nil {
			return err
		}
		return nil
	}); err != nil {
		return nil, status.Error(codes.PermissionDenied, "forbidden")
	}

	ctx = context.WithValue(ctx, "db", db)

	return handler(ctx, req)
}
