package lib

import (
	"time"

	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/webauthn"
	"github.com/gofiber/fiber/v3/log"
)

var webAuthn *webauthn.WebAuthn

func GetOrInitWebAuthn(timeout time.Duration, debug bool) (*webauthn.WebAuthn, error) {
	if webAuthn != nil {
		return webAuthn, nil
	}
	wconfig := &webauthn.Config{
		RPDisplayName: "TeachMe",
		RPID:          "",
		RPOrigins:     []string{},
		AuthenticatorSelection: protocol.AuthenticatorSelection{
			AuthenticatorAttachment: protocol.CrossPlatform,
			RequireResidentKey:      protocol.ResidentKeyNotRequired(),
			UserVerification:        protocol.VerificationRequired,
		},
		AttestationPreference: protocol.PreferNoAttestation,
		Debug:                 debug,
		Timeouts: webauthn.TimeoutsConfig{
			Registration: webauthn.TimeoutConfig{
				Timeout: timeout,
				Enforce: !debug,
			},
			Login: webauthn.TimeoutConfig{
				Timeout: timeout,
				Enforce: !debug,
			},
		},
	}
	wauth, err := webauthn.New(wconfig)
	if err != nil {
		log.Errorf("[WEBAUTHN] could not initialize webauthn: %v", err)
		return nil, err
	}
	webAuthn = wauth
	return nil, err
}
