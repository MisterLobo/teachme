import { Test, TestingModule } from '@nestjs/testing';
import { Nats } from './nats';

describe('Nats', () => {
  let provider: Nats;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [Nats],
    }).compile();

    provider = module.get<Nats>(Nats);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });
});
