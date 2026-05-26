import { Test, TestingModule } from '@nestjs/testing';
import { Stripe } from './stripe';

describe('Stripe', () => {
  let provider: Stripe;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [Stripe],
    }).compile();

    provider = module.get<Stripe>(Stripe);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });
});
