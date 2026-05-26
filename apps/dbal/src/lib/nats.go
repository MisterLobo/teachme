package lib

import (
	"context"
	"log"
	"os"

	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"
)

var conn *nats.Conn
var js jetstream.JetStream

type EventSubsciptionParams struct {
	Js            jetstream.JetStream
	Handler       func(msg *nats.Msg)
	StreamName    string
	ConsumerName  *string
	Subjects      []string
	Subject       string
	WithEphemeral bool
	WithChannel   bool
	WithQueue     bool
	WithChanQueue bool
	EphemeralFunc func(msg *nats.Msg)
	ChannelFunc   func(msg *nats.Msg)
	QueueFunc     nats.MsgHandler
	Channel       chan *nats.Msg
	QueueName     string
	IsSync        bool
}

func GetNatsInstance() (*nats.Conn, jetstream.JetStream, error) {
	if conn != nil && js != nil {
		return conn, js, nil
	}
	conn, err := nats.Connect(
		"localhost:4222",
		nats.RootCAs(os.Getenv("CA_PEM_FILE")),
		nats.ClientCert(os.Getenv("CERT_PEM_FILE"), os.Getenv("CERT_KEY_FILE")),
		nats.TLSHandshakeFirst(),
		nats.Token(os.Getenv("NATS_AUTH_TOKEN")),
		nats.Name("core.service.internal"),
	)
	if err != nil {
		log.Printf("NATS error: %s", err.Error())
		return nil, nil, err
	}
	log.Println("[NATS] ready to accept messages")

	js, err = jetstream.New(conn)
	if err != nil {
		return nil, nil, err
	}
	return conn, js, nil
}

func SubscribeToEvents(ctx context.Context, params *EventSubsciptionParams, syncSubscriber *nats.Subscription, syncQueue *nats.Subscription) error {
	stream, err := params.Js.Stream(ctx, params.StreamName)
	if err != nil {
		log.Printf("could not subscribe to event stream %s: %v\n", params.StreamName, err)
		return err
	}
	params.Js.Conn().Subscribe(params.Subject, params.Handler)
	log.Printf("[NATS.js] subscriber listening to %s with subject: %s", params.StreamName, params.Subject)

	if params.ConsumerName != nil {
		cons, err := stream.Consumer(ctx, *params.ConsumerName)
		if err != nil {
			log.Printf("[NATS] could not retrieve consumer info: %v", err)
			return err
		}
		_, err = cons.Consume(func(msg jetstream.Msg) {})
		if err != nil {
			log.Printf("[NATS] error on consumption: %v", err)
			return err
		}
		// defer cc.Stop()
		log.Printf("[NATS] subscriber listening to %s with subject: %s", *params.ConsumerName, params.Subject)
	}

	nc, _, _ := GetNatsInstance()
	if params.WithEphemeral {
		if params.IsSync {
			syncSubscriber, err = nc.SubscribeSync(params.Subject)
			if err != nil {
				return err
			}
		} else {
			nc.Subscribe(params.Subject, params.EphemeralFunc)
		}
	}
	if params.WithChannel {
		nc.ChanSubscribe(params.Subject, params.Channel)
	}
	if params.WithQueue {
		if params.IsSync {
			syncQueue, err = nc.QueueSubscribeSync(params.Subject, params.QueueName)
			if err != nil {
				return err
			}
		} else {
			nc.QueueSubscribe(params.Subject, params.QueueName, params.QueueFunc)
		}
	}

	return nil
}
