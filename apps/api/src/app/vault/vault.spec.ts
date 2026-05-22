import { Test, TestingModule } from '@nestjs/testing';
import { Vault } from './vault';

describe('Vault', () => {
  let provider: Vault;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [Vault],
    }).compile();

    provider = module.get<Vault>(Vault);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });
});
