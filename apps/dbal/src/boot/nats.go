package boot

import (
	"context"
	"fmt"
	"log"

	"github.com/misterlobo/teachme/src/lib"
	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"
)

func getOrCreateStream(ctx context.Context, js jetstream.JetStream, name string, subjects []string, deleteIfError bool) (jetstream.Stream, error) {
	notifs, err := js.Stream(ctx, name)
	/* if deleteIfOverlapping && err == jetstream.ErrOverlappingFilterSubjects {
		deleteStream(ctx, js, name)
		return nil, nil
	} */
	if err == jetstream.ErrStreamNotFound {
		return js.CreateStream(ctx, jetstream.StreamConfig{
			Name:     name,
			Subjects: subjects,
		})
	}
	if err != nil {
		if deleteIfError {
			deleteStream(ctx, js, name)
			return nil, nil
		}
		return nil, err
	}
	return notifs, nil
}

func getOrCreateConsumer(ctx context.Context, s jetstream.Stream, name string, isDurable bool) (jetstream.Consumer, error) {
	consumer, err := s.Consumer(ctx, name)
	if err == jetstream.ErrConsumerNotFound {
		jsconfig := jetstream.ConsumerConfig{
			Name:    name,
			Durable: name,
		}
		if isDurable {
			jsconfig.Durable = name
		}
		return s.CreateConsumer(ctx, jsconfig)
	}
	if err != nil {
		return nil, err
	}
	return consumer, nil
}

func deleteStream(ctx context.Context, s jetstream.JetStream, name string) error {
	_, err := s.Stream(ctx, name)
	if err != nil {
		return err
	}
	return s.DeleteStream(ctx, name)
}

func purgeAllStreams(ctx context.Context) error {
	_, js, _ := lib.GetNatsInstance()
	streamNames := js.StreamNames(ctx)
	for streamName := range streamNames.Name() {
		if err := deleteStream(ctx, js, streamName); err != nil {
			log.Printf("[eventBus] could not delete stream %s: %v", streamName, err)
			return err
		}
	}
	return nil
}

func InitEventBus(ctx context.Context) context.Context {
	purgeAllStreams(ctx)

	nc, js, err := lib.GetNatsInstance()
	if err != nil {
		log.Fatalf("[eventbus] could not initialize event bus: %v", err)
	}

	test, err := getOrCreateStream(ctx, js, "testabcd", []string{"testabcd.*"}, true)
	if err != nil {
		log.Fatalf("Could not create stream: %v", err)
	}
	if _, err = getOrCreateConsumer(ctx, test, "testabcd:foo", true); err != nil {
		log.Fatalf("Could not create consumer 'test': %v", err)
	}

	auth, err := getOrCreateStream(ctx, js, "auth", []string{"auth.*"}, true)
	if err != nil {
		log.Fatalf("Could not create stream: %v", err)
	}
	if _, err = getOrCreateConsumer(ctx, auth, "auth", true); err != nil {
		log.Fatalf("Could not create consumer 'auth': %v", err)
	}
	authConsumer := "auth"
	lib.SubscribeToEvents(ctx, &lib.EventSubsciptionParams{
		Js: js,
		Handler: func(msg *nats.Msg) {
			msg.Ack()
			fmt.Println("[NATS.js] message received: ", string(msg.Data))
		},
		StreamName:   "auth",
		Subject:      "auth.*",
		Subjects:     []string{},
		ConsumerName: &authConsumer,
		// WithEphemeral: true,
		/* EphemeralFunc: func(msg *nats.Msg) {
			log.Printf("[eph] rcv message: %s", string(msg.Data))
		}, */
	}, nil, nil)

	booking, err := getOrCreateStream(ctx, js, "booking", []string{"booking.*"}, true)
	if err != nil {
		log.Fatalf("Could not create stream: %v", err)
	}
	if _, err = getOrCreateConsumer(ctx, booking, "booking", true); err != nil {
		log.Fatalf("Could not create consumer 'booking': %v", err)
	}
	bookingConsumer := "booking"
	lib.SubscribeToEvents(ctx, &lib.EventSubsciptionParams{
		Js: js,
		Handler: func(msg *nats.Msg) {
			msg.Ack()
			fmt.Println("[NATS.js] message received: ", string(msg.Data))
		},
		StreamName:   "booking",
		Subject:      "booking.*",
		Subjects:     []string{},
		ConsumerName: &bookingConsumer,
		// WithEphemeral: true,
		/* EphemeralFunc: func(msg *nats.Msg) {
			log.Printf("[eph] rcv message: %s", string(msg.Data))
		}, */
	}, nil, nil)

	agents, err := getOrCreateStream(ctx, js, "agents", []string{"agents.*"}, true)
	if err != nil {
		log.Fatalf("Could not create stream: %v", err)
	}
	if _, err := getOrCreateConsumer(ctx, agents, "agents:discovery", true); err != nil {
		log.Fatalf("Could not create consumer 'agents': %v", err)
	}
	agentsConsumer := "agents:discovery"
	lib.SubscribeToEvents(ctx, &lib.EventSubsciptionParams{
		Js: js,
		Handler: func(msg *nats.Msg) {
			msg.Ack()
			fmt.Println("[NATS.js] message received: ", string(msg.Data))
		},
		StreamName:    "agents",
		Subject:       "agents.*",
		Subjects:      []string{"agents.*"},
		ConsumerName:  &agentsConsumer,
		WithEphemeral: true,
		EphemeralFunc: func(msg *nats.Msg) {
			log.Printf("[agents] rcv message: %s", string(msg.Data))
		},
	}, nil, nil)

	notifs, err := getOrCreateStream(ctx, js, "notifications", []string{"notification.*"}, true)
	if err != nil {
		log.Fatalf("Could not create stream: %v", err)
	}
	if _, err = getOrCreateConsumer(ctx, notifs, "notifications", true); err != nil {
		log.Fatalf("Could not create consumer 'notifications': %v", err)
	}

	paymentEvents, err := getOrCreateStream(ctx, js, "payments", []string{"payments.*"}, true)
	if err != nil {
		log.Fatalf("Could not create stream payments: %v", err)
	}
	if _, err = getOrCreateConsumer(ctx, paymentEvents, "payments", true); err != nil {
		log.Fatalf("Could not create consumer: %v", err)
	}
	paymentsConsumer := "payments"
	lib.SubscribeToEvents(ctx, &lib.EventSubsciptionParams{
		Js: js,
		Handler: func(msg *nats.Msg) {
			msg.Ack()
			fmt.Println("[NATS.js] message received: ", string(msg.Data))
		},
		StreamName:    "payments",
		Subject:       "payments.*",
		Subjects:      []string{},
		ConsumerName:  &paymentsConsumer,
		WithEphemeral: true,
		EphemeralFunc: func(msg *nats.Msg) {
			log.Printf("[eph] rcv message: %s", string(msg.Data))
		},
	}, nil, nil)

	stripeAccountsEvents, err := getOrCreateStream(ctx, js, "stripe:accounts", []string{"stripe.accounts.*"}, true)
	if err != nil {
		log.Fatalf("Could not create stream stripe:accounts: %v", err)
	}
	if _, err = getOrCreateConsumer(ctx, stripeAccountsEvents, "stripe:accounts", true); err != nil {
		log.Fatalf("Could not create consumer: %v", err)
	}
	stripeAccountsConsumer := "stripe:accounts"
	lib.SubscribeToEvents(ctx, &lib.EventSubsciptionParams{
		Js: js,
		Handler: func(msg *nats.Msg) {
			msg.Ack()
			fmt.Println("[NATS.js] message received: ", string(msg.Data))
		},
		StreamName:    "stripe:accounts",
		Subject:       "stripe.accounts.*",
		Subjects:      []string{},
		ConsumerName:  &stripeAccountsConsumer,
		WithEphemeral: true,
		EphemeralFunc: func(msg *nats.Msg) {
			log.Printf("[eph] rcv message: %s", string(msg.Data))
		},
	}, nil, nil)

	stripeBillingEvents, err := getOrCreateStream(ctx, js, "stripe:billing", []string{"stripe.billing.*"}, true)
	if err != nil {
		log.Fatalf("Could not create stream stripe:billing: %v", err)
	}
	if _, err = getOrCreateConsumer(ctx, stripeBillingEvents, "stripe:billing", true); err != nil {
		log.Fatalf("Could not create consumer: %v", err)
	}
	stripeBillingConsumer := "stripe:billing"
	lib.SubscribeToEvents(ctx, &lib.EventSubsciptionParams{
		Js: js,
		Handler: func(msg *nats.Msg) {
			msg.Ack()
			fmt.Println("[NATS.js] message received: ", string(msg.Data))
		},
		StreamName:    "stripe:billing",
		Subject:       "stripe.billing.*",
		Subjects:      []string{},
		ConsumerName:  &stripeBillingConsumer,
		WithEphemeral: true,
		EphemeralFunc: func(msg *nats.Msg) {
			log.Printf("[eph] rcv message: %s", string(msg.Data))
		},
	}, nil, nil)

	stripeCustomerEvents, err := getOrCreateStream(ctx, js, "stripe:customer", []string{"stripe.customer.*"}, true)
	if err != nil {
		log.Fatalf("Could not create stream stripe:customer: %v", err)
	}
	if _, err = getOrCreateConsumer(ctx, stripeCustomerEvents, "stripe:customer", true); err != nil {
		log.Fatalf("Could not create consumer: %v", err)
	}
	stripeCustomerConsumer := "stripe:customer"
	lib.SubscribeToEvents(ctx, &lib.EventSubsciptionParams{
		Js: js,
		Handler: func(msg *nats.Msg) {
			msg.Ack()
			fmt.Println("[NATS.js] message received: ", string(msg.Data))
		},
		StreamName:    "stripe:customer",
		Subject:       "stripe.customer.*",
		Subjects:      []string{},
		ConsumerName:  &stripeCustomerConsumer,
		WithEphemeral: true,
		EphemeralFunc: func(msg *nats.Msg) {
			log.Printf("[eph] rcv message: %s", string(msg.Data))
		},
	}, nil, nil)

	/* testConsumer := "test:foo"
	lib.SubscribeToEvents(ctx, &lib.EventSubsciptionParams{
		Js:            js,
		StreamName:    "test",
		Subject:       "test.foo",
		Subjects:      []string{},
		ConsumerName:  &testConsumer,
		WithEphemeral: true,
		EphemeralFunc: func(msg *nats.Msg) {
			log.Printf("[eph] rcv message: %s", string(msg.Data))
		},
	}, nil, nil) */

	log.Printf("[NATS] subscribing to foo")
	nc.Subscribe("agents.discovery", func(msg *nats.Msg) {
		msg.Respond([]byte("hello from dbal"))
	})

	log.Printf("[NATS] subscribing to foo")
	nc.Subscribe("test.foo", func(msg *nats.Msg) {
		msg.Respond([]byte("hello from dbal"))
	})

	log.Println("[NATS] publishing to foo")
	nc.Publish("test.foo", []byte("barz"))

	log.Println("[jetstream] publishing to foo")
	js.PublishAsync("test.foo", []byte("payload"))
	ctx = context.WithValue(ctx, "js", js)

	streams := js.StreamNames(ctx)
	for stream := range streams.Name() {
		log.Printf("stream: %s", stream)
	}

	log.Println("[jetstream] publishing to foo")
	js.PublishAsync("test.foo", []byte("payload"))
	ctx = context.WithValue(ctx, "js", js)

	js.PublishAsync("agents.discovery", []byte("payload"))
	// deleteStream(ctx, js, "test")

	return ctx
}

/* func subscribeToEvents(ctx context.Context, params *lib.EventSubsciptionParams, syncSubscriber *nats.Subscription, syncQueue *nats.Subscription) error {
	stream, err := params.Js.Stream(ctx, params.StreamName)
	if err != nil {
		log.Printf("could not subscribe to event stream %s: %v\n", params.StreamName, err)
		return err
	}
	params.Js.Conn().Subscribe(params.Subject, func(msg *nats.Msg) {
		msg.Ack()
		fmt.Println("[NATS.js] message received: ", string(msg.Data))
	})
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

	nc, _, _ := lib.GetNatsInstance()
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
} */
